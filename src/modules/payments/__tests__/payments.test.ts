import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** Payments end to end on an isolated database, with invented people and debits: the failure sheet
 *  counted first and added once, at the uploader's sites only, matched to swimmers by member
 *  number; reception's contacts and closes at their sites only, version-checked and replay-safe;
 *  reopening for Manage; the lists, Home items and the swimmer profile's notices; and an audit row
 *  with every change. The workbook reader and the swim school's directory are faked. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let upload: typeof import("../features/upload/server/actions");
let steps: typeof import("../features/failures/server/actions");
let data: typeof import("../features/failures/server/data");
let home: typeof import("../features/failures/server/home");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; screens: string[]; scopeKind: string; scopeId: string };
const state = { id: "lena", permissions: [] as string[], grants: [] as GrantRow[] };
let bishopstown = "", churchfield = "";

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: ["payments"], primaryScreens: ["payments"], grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
const as = (id: string, grants: GrantRow[], permissions: string[] = []) => Object.assign(state, { id, permissions, grants });
const at = (siteId: string, ...permissions: string[]): GrantRow => ({ roleName: "Site", permissions, screens: ["payments"], scopeKind: "site", scopeId: siteId });
const uuid = () => crypto.randomUUID();

const HEAD = ["Club Name", "Contact Name", "Amount", "Reference", "Return Code", "Return Description", "Membership Number", "Message"];
const sheet = { current: [] as { sheet: string; data: unknown[][] }[] };
const workbook = (...rows: unknown[][]) => { sheet.current = [{ sheet: "CF", data: [HEAD, ...rows, [null, null, 100, 3, null, null, null, null]] }]; };
const file = (name = "Failed Lessons 09.xlsx") => new File([new Uint8Array([80, 75, 3, 4])], name);
const form = (fields: Record<string, string | File>) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); return f; };

const swimmers = new Map([["LWC1001", { id: "swimmer-1", memberNumber: "LWC1001", firstName: "Synthetic", lastName: "Swimmer", dateOfBirth: null, active: true, contactName: "Synthetic Parent" }]]);
const directory = {
  app: "swim-school",
  search: async () => [],
  byNumbers: async (numbers: readonly string[]) => new Map([...swimmers].filter(([n]) => numbers.includes(n))),
  byIds: async (ids: readonly string[]) => new Map([...swimmers.values()].filter((s) => ids.includes(s.id)).map((s) => [s.id, { ...s, contactEmail: "parent@example.invalid", contactPhone: "087 000 0000",
    emergencyName: null, emergencyPhone: null, emergencyRelationship: null, hasMedicalNotes: false, medicalNotes: null }])),
  create: async () => ({ ok: false as const, error: "Not in this test" }),
};

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  const clubs = await db.club.findMany({ where: { orgId: ORG }, orderBy: { name: "asc" } });
  bishopstown = clubs.find((c) => c.name.includes("Bishopstown"))!.id;
  churchfield = clubs.find((c) => c.name.includes("Churchfield"))!.id;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["lena", "tom", "mia"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG } });
  const d = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => churchfield, currentClubIdIfAny: async () => churchfield },
    "@/lib/xlsx": { readWorkbook: async () => sheet.current },
    "@/modules/contributions": { members: async () => directory },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  upload = serverModule("src/modules/payments/features/upload/server/actions.ts", d);
  steps = serverModule("src/modules/payments/features/failures/server/actions.ts", d);
  data = serverModule("src/modules/payments/features/failures/server/data.ts", d);
  home = serverModule("src/modules/payments/features/failures/server/home.ts", d);
});
after(async () => { await fixture?.close(); });

const manager = () => as("mia", [at(churchfield, "payments.manage")]);
const reception = () => as("lena", [at(churchfield, "payments.follow")]);
const failure = (reference: string) => fixture.prisma.paymentFailure.findFirstOrThrow({ where: { reference } });

test("the sheet is counted first, then added once, at the uploader's sites only, matched to swimmers", async () => {
  workbook(
    ["LW Churchfield", "Synthetic Parent", 54, "A/LWC1001", "AM04", "Insufficient Funds", "LWC1001", null],
    ["LW Churchfield", "Example Person", 46, "B/LWC2002", "MD01", "No Mandate", "LWC2002", null],
    ["LW Bishopstown", "Another Example", 65, "A/LWB3003", "AM04", "Insufficient Funds", "LWB3003", null],
  );
  reception();
  assert.equal((await upload.previewFailureSheet(form({ file: file() }))).ok, false, "Use cannot upload");
  manager();
  const preview = await upload.previewFailureSheet(form({ file: file() }));
  assert.ok(preview.ok);
  assert.equal(preview.preview.month.slice(5), "09", "the month from the file's name");
  assert.deepEqual([preview.preview.rows, preview.preview.added, preview.preview.elsewhere, preview.preview.swimmers], [3, 2, 1, 1]);
  assert.equal(await fixture.prisma.paymentFailure.count(), 0, "the count saves nothing");

  const operationId = uuid();
  const added = await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId }));
  assert.deepEqual(added, { ok: true, added: 2, month: "2026-09" });
  assert.deepEqual(await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId })), { ok: true, added: 2, month: "2026-09" }, "a second press of Add");
  assert.equal((await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId: uuid() }))).ok, false, "the same sheet again adds nothing");
  assert.equal(await fixture.prisma.paymentFailure.count(), 2);
  const matched = await failure("A/LWC1001");
  assert.deepEqual([matched.siteId, matched.memberId, matched.amountCents, matched.status, matched.orgId], [churchfield, "swimmer-1", 5400, "to_contact", ORG]);
  assert.equal((await failure("B/LWC2002")).memberId, null, "not on the swimmer records");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "PaymentFailure" } });
  assert.equal(audit.length, 2);
  assert.ok(audit.every((a) => a.module === "Payments" && a.clubId === churchfield));
});

test("a club name that matches no site is left out and named; the rest are added", async () => {
  manager();
  workbook(
    ["LW Riverside", "Synthetic", 20.5, "A/X1", "AM04", "", "X1", null],
    ["LW Churchfield", "Synthetic Other", 46, "A/LWC4004", "AM04", "", "LWC4004", null],
  );
  const preview = await upload.previewFailureSheet(form({ file: file(), month: "2026-10" }));
  assert.ok(preview.ok);
  assert.deepEqual(preview.preview.unknownClubs, [{ club: "LW Riverside", rows: 1, cents: "€20.50" }]);
  assert.equal(preview.preview.added, 1);
  assert.deepEqual(await upload.uploadFailureSheet(form({ file: file(), month: "2026-10", operationId: uuid() })), { ok: true, added: 1, month: "2026-10" });
  assert.equal(await fixture.prisma.paymentFailure.count({ where: { month: "2026-10" } }), 1);

  workbook(["LW Riverside", "Synthetic", 20.5, "A/X1", "AM04", "", "X1", null]);
  const none = await upload.uploadFailureSheet(form({ file: file(), month: "2026-10", operationId: uuid() }));
  assert.equal(none.ok, false, "a sheet with only unmatched clubs adds nothing");
  assert.match(none.ok ? "" : none.error, /LW Riverside/);
  await fixture.prisma.auditLog.deleteMany({ where: { entity: "PaymentFailure", summary: { contains: "October" } } });
  await fixture.prisma.paymentFailureEvent.deleteMany({ where: { failure: { month: "2026-10" } } });
  await fixture.prisma.paymentFailure.deleteMany({ where: { month: "2026-10" } });
});

test("reception logs contacts and records how it ended, at their sites only, once per press", async () => {
  reception();
  const row = await failure("A/LWC1001");
  const contact = { id: row.id, operationId: uuid(), version: row.version, method: "phone" as const, result: "no_answer" as const, note: "" };
  assert.deepEqual(await steps.logContact(contact), { ok: true, id: row.id });
  assert.deepEqual(await steps.logContact(contact), { ok: true, id: row.id }, "a second press of Save");
  let saved = await failure("A/LWC1001");
  assert.deepEqual([saved.status, saved.attempts, saved.version], ["contacted", 1, 2]);
  assert.equal((await steps.logContact({ ...contact, operationId: uuid() })).ok, false, "an old version is refused");
  assert.equal((await steps.closeFailure({ id: row.id, operationId: uuid(), version: saved.version, outcome: "cancelled", note: "" })).ok, false, "a cancelled place needs a reason");
  assert.equal((await steps.closeFailure({ id: row.id, operationId: uuid(), version: saved.version, outcome: "paid", note: "Paid by card" })).ok, true);
  saved = await failure("A/LWC1001");
  assert.deepEqual([saved.status, saved.closedByName, saved.outcome], ["paid", "lena", "Paid by card"]);
  assert.equal((await steps.reopenFailure({ id: row.id, operationId: uuid(), version: saved.version, note: "Card payment bounced" })).ok, false, "reopening is Manage's");

  as("tom", [at(bishopstown, "payments.follow")]);
  const other = await failure("B/LWC2002");
  assert.equal((await steps.logContact({ id: other.id, operationId: uuid(), version: other.version, method: "text", result: "message", note: "" })).ok, false, "a site the role does not cover");
  const events = await fixture.prisma.paymentFailureEvent.findMany({ where: { failureId: row.id }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(events.map((e) => e.action), ["import", "contact", "paid"]);
});

test("Manage opens a closed payment again: back to contacted, since someone was in touch", async () => {
  manager();
  const row = await failure("A/LWC1001");
  assert.equal((await steps.reopenFailure({ id: row.id, operationId: uuid(), version: row.version, note: "Card payment bounced" })).ok, true);
  const saved = await failure("A/LWC1001");
  assert.deepEqual([saved.status, saved.closedAt, saved.outcome], ["contacted", null, ""]);
});

test("the lists, Home and the swimmer's notices show what is still open at the person's sites", async () => {
  reception();
  const lists = await data.paymentLists({});
  assert.equal(lists.show, "to_contact");
  assert.deepEqual([lists.counts.to_contact, lists.counts.contacted, lists.counts.closed], [1, 1, 0]);
  assert.equal(lists.owedCents, 10000);
  assert.deepEqual(lists.rows.map((r) => r.reference), ["B/LWC2002"]);
  assert.deepEqual((await data.paymentLists({ show: "contacted", q: "lwc1001" })).rows.map((r) => r.reference), ["A/LWC1001"], "found by member number");
  const one = await data.getPaymentFailure((await failure("A/LWC1001")).id);
  assert.equal(one.member?.contactPhone, "087 000 0000", "the contact comes from the swimmer records");
  assert.deepEqual(one.can, { follow: true, manage: false });

  const items = await home.paymentsHomeItems({ id: "lena", name: "lena", permissions: ["payments.follow"], anywhere: ["payments.follow"], isSuperadmin: false });
  assert.deepEqual(items.map((i) => [i.label, i.count]), [["Failed payments to contact", 1], ["Failed payments waiting on the member", 1]]);

  const notices = await data.memberPaymentNotices("swimmer-1");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].label, "Payment failed");
  assert.match(notices[0].hint, /September 2026/);

  as("tom", [at(bishopstown, "payments.read")]);
  assert.deepEqual((await data.paymentLists({})).counts, { to_contact: 0, contacted: 0, closed: 0 }, "another site's payments stay out");
  await assert.rejects(data.getPaymentFailure((await failure("A/LWC1001")).id), /not available/);
});
