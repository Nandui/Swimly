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
let upload: typeof import("../features/payment-upload/server/actions");
let steps: typeof import("../features/failed-payments/server/actions");
let data: typeof import("../features/failed-payments/server/data");
let home: typeof import("../features/failed-payments/server/home");
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

const mailbox = { sent: [] as { to: string; subject: string }[], failing: false };
const swimmer = (n: number, memberNumber: string) => [memberNumber, { id: `swimmer-${n}`, memberNumber, firstName: "Synthetic", lastName: `Swimmer ${n}`, dateOfBirth: null, active: true, contactName: "Synthetic Parent" }] as const;
const swimmers = new Map([swimmer(1, "LWC1001"), swimmer(2, "LWC2002"), swimmer(3, "LWB3003"), swimmer(4, "X1"), swimmer(5, "LWC4004")]);
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
    "@/modules/activities/shared/parents/family-email": {
      familyEmailText: (e: { before: string[]; after: string[] }) => [...e.before, ...e.after].join(" "),
      sendFamilyEmail: async (to: string, subject: string) => { if (mailbox.failing) throw new Error("provider down"); mailbox.sent.push({ to, subject }); },
    },
    "next/cache": { revalidatePath() {} },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  upload = serverModule("src/modules/activities/features/payment-upload/server/actions.ts", d);
  steps = serverModule("src/modules/activities/features/failed-payments/server/actions.ts", d);
  data = serverModule("src/modules/activities/features/failed-payments/server/data.ts", d);
  home = serverModule("src/modules/activities/features/failed-payments/server/home.ts", d);
});
after(async () => { await fixture?.close(); });

const manager = () => as("mia", [at(churchfield, "payments.manage")]);
const reception = () => as("lena", [at(churchfield, "payments.follow")]);
const failure = (reference: string) => fixture.prisma.paymentFailure.findFirstOrThrow({ where: { reference } });

test("the sheet is counted first, then added once: swimmers only, at the uploader's sites only", async () => {
  workbook(
    ["LW Churchfield", "Synthetic Parent", 54, "A/LWC1001", "AM04", "Insufficient Funds", "LWC1001", null],
    ["LW Churchfield", "Gym Member", 40, "A/GYM9009", "AM04", "Insufficient Funds", "GYM9009", null],
    ["LW Churchfield", "Example Person", 46, "B/LWC2002", "MD01", "No Mandate", "LWC2002", null],
    ["LW Bishopstown", "Another Example", 65, "A/LWB3003", "AM04", "Insufficient Funds", "LWB3003", null],
  );
  reception();
  assert.equal((await upload.previewFailureSheet(form({ file: file() }))).ok, false, "Use cannot upload");
  manager();
  const preview = await upload.previewFailureSheet(form({ file: file() }));
  assert.ok(preview.ok);
  assert.equal(preview.preview.month.slice(5), "09", "the month from the file's name");
  assert.deepEqual([preview.preview.rows, preview.preview.added, preview.preview.elsewhere, preview.preview.notSwimmers], [4, 2, 1, 1]);
  assert.equal(await fixture.prisma.paymentFailure.count(), 0, "the count saves nothing");

  const operationId = uuid();
  const added = await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId }));
  assert.deepEqual(added, { ok: true, added: 2, month: "2026-09" });
  assert.deepEqual(await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId })), { ok: true, added: 2, month: "2026-09" }, "a second press of Add");
  assert.equal((await upload.uploadFailureSheet(form({ file: file(), month: "2026-09", operationId: uuid() }))).ok, false, "the same sheet again adds nothing");
  const again = await upload.previewFailureSheet(form({ file: file(), month: "2026-08" }));
  assert.ok(again.ok);
  assert.match(again.preview.uploadedBefore ?? "", /September 2026 by mia/, "the same sheet under another month is recognised");
  const otherMonth = await upload.uploadFailureSheet(form({ file: file(), month: "2026-08", operationId: uuid() }));
  assert.equal(otherMonth.ok, false, "and refused, so nothing is added twice");
  assert.match(otherMonth.ok ? "" : otherMonth.error, /already uploaded for September 2026/);
  assert.equal(await fixture.prisma.paymentFailure.count(), 2);
  assert.equal(await fixture.prisma.paymentFailure.count(), 2);
  const matched = await failure("A/LWC1001");
  assert.deepEqual([matched.siteId, matched.memberId, matched.amountCents, matched.status, matched.orgId], [churchfield, "swimmer-1", 5400, "to_contact", ORG]);
  assert.equal((await failure("B/LWC2002")).memberId, "swimmer-2");
  assert.equal(await fixture.prisma.paymentFailure.count({ where: { reference: "A/GYM9009" } }), 0, "a member number that is no swimmer is never tracked");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entity: "PaymentFailure" } });
  assert.equal(audit.length, 2);
  assert.ok(audit.every((a) => a.module === "Swim school" && a.clubId === churchfield));
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

  workbook(["LW Churchfield", "Gym Member", 40, "A/GYM9010", "AM04", "", "GYM9010", null]);
  const gym = await upload.uploadFailureSheet(form({ file: file(), month: "2026-10", operationId: uuid() }));
  assert.equal(gym.ok, false, "a sheet with no swimmers adds nothing");
  assert.match(gym.ok ? "" : gym.error, /belong to a swimmer/);
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
  assert.deepEqual(items.map((i) => [i.label, i.count]), [["Payment emails ready to send", 2], ["Failed payments to contact", 1], ["Failed payments waiting on the member", 1]], "both linked to a swimmer, neither emailed yet");

  const notices = await data.memberPaymentNotices("swimmer-1");
  assert.equal(notices.length, 1);
  assert.equal(notices[0].label, "Payment failed");
  assert.match(notices[0].hint, /September 2026/);

  as("tom", [at(bishopstown, "payments.read")]);
  assert.deepEqual((await data.paymentLists({})).counts, { to_contact: 0, contacted: 0, closed: 0 }, "another site's payments stay out");
  await assert.rejects(data.getPaymentFailure((await failure("A/LWC1001")).id), /not available/);
});

test("Manage removes payments with no swimmer behind them, at their sites only, linking any that are swimmers now", async () => {
  const db = fixture.prisma;
  const old = (reference: string, memberNumber: string, siteId: string) => db.paymentFailure.create({ data: {
    orgId: ORG, siteId, importId: "before-swimmers-only", month: "2026-08", reference, memberNumber, name: "Synthetic Old", amountCents: 4000 } });
  const gym = await old("A/GYM7007", "GYM7007", churchfield);
  await db.paymentFailureEvent.create({ data: { orgId: ORG, failureId: gym.id, operationId: uuid(), actorId: "lena", actorName: "lena", action: "contact" } });
  const now = await old("A/LWC4004", "LWC4004", churchfield);
  const elsewhere = await old("A/GYM8008", "GYM8008", bishopstown);

  reception();
  assert.equal((await steps.removeNonSwimmers()).ok, false, "Use cannot remove");
  manager();
  assert.deepEqual((await data.paymentLists({})).nonSwimmers, { remove: 1, worked: 0, link: 1 });
  assert.deepEqual(await steps.removeNonSwimmers(), { ok: true });
  assert.equal(await db.paymentFailure.count({ where: { id: gym.id } }), 0, "the gym member's payment is gone");
  assert.equal(await db.paymentFailureEvent.count({ where: { failureId: gym.id } }), 0, "with its history");
  assert.equal((await db.paymentFailure.findUniqueOrThrow({ where: { id: now.id } })).memberId, "swimmer-5", "a swimmer now is linked instead");
  assert.equal(await db.paymentFailure.count({ where: { id: elsewhere.id } }), 1, "another site's is left for its managers");
  const audit = await db.auditLog.findMany({ where: { entityId: { in: [gym.id, now.id] } } });
  assert.deepEqual(audit.map((a) => a.action).sort(), ["delete", "update"]);
  assert.deepEqual((await data.paymentLists({})).nonSwimmers, { remove: 0, worked: 0, link: 0 });
});

test("Manage removes a wrong upload: its payments and their history go, and the same sheet can be uploaded again", async () => {
  const db = fixture.prisma;
  const history = serverModule<typeof import("../features/payment-upload/server/history")>("src/modules/activities/features/payment-upload/server/history.ts", {
    "@/lib/prisma": { prisma: db }, "server-only": {}, react: { cache: <T,>(fn: T) => fn },
    "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p), canSee: () => true },
    "@/lib/clubs/current": { currentClubId: async () => churchfield, currentClubIdIfAny: async () => churchfield },
  });
  manager();
  workbook(
    ["LW Churchfield", "Synthetic Parent", 30, "W/LWC1001", "AM04", "Insufficient Funds", "LWC1001", null],
    ["LW Churchfield", "Example Person", 31, "W/LWC2002", "MD01", "No Mandate", "LWC2002", null],
  );
  const sent = await upload.uploadFailureSheet(form({ file: file("Wrong sheet 07.xlsx"), month: "2026-07", operationId: uuid() }));
  assert.deepEqual(sent, { ok: true, added: 2, month: "2026-07" });
  const one = await failure("W/LWC1001");
  reception();
  assert.equal((await steps.logContact({ id: one.id, operationId: uuid(), version: one.version, method: "phone", result: "spoke", note: "" })).ok, true);

  manager();
  const wrong = (await history.uploadHistory()).find((u) => u.fileName === "Wrong sheet 07.xlsx")!;
  assert.deepEqual([wrong.month, wrong.onList, wrong.worked], ["2026-07", 2, 1]);
  reception();
  assert.equal((await upload.removeUpload(wrong.id)).ok, false, "Use cannot remove an upload");
  manager();
  assert.deepEqual(await upload.removeUpload(wrong.id), { ok: true });
  assert.equal(await db.paymentFailure.count({ where: { importId: wrong.id } }), 0);
  assert.equal(await db.paymentFailureEvent.count({ where: { failureId: one.id } }), 0, "with their history");
  assert.equal(await db.paymentImport.count({ where: { id: wrong.id } }), 0, "and the upload's own record");
  assert.equal(await db.auditLog.count({ where: { action: "delete", summary: { contains: "Removed with its upload, Wrong sheet 07.xlsx" } } }), 2);
  assert.equal((await upload.removeUpload(wrong.id)).ok, false, "a second press finds nothing");
  assert.deepEqual(await upload.uploadFailureSheet(form({ file: file("Wrong sheet 07.xlsx"), month: "2026-07", operationId: uuid() })), { ok: true, added: 2, month: "2026-07" },
    "the same sheet goes in again once its upload is removed");
});

test("reception sends the three warning emails in turn, each when due; only the live site emails, and a failed send records nothing", async () => {
  const db = fixture.prisma;
  manager();
  workbook(["LW Churchfield", "Synthetic Parent", 54, "E/LWC1001", "AM04", "Insufficient Funds", "LWC1001", null]);
  assert.equal((await upload.uploadFailureSheet(form({ file: file("Email test 06.xlsx"), month: "2026-06", operationId: uuid() }))).ok, true);
  const id = (await failure("E/LWC1001")).id;
  const send = async (step: 1 | 2 | 3) => { const row = await db.paymentFailure.findUniqueOrThrow({ where: { id } }); return steps.sendPaymentEmail({ id, operationId: uuid(), version: row.version, step }); };

  reception();
  let page = await data.getPaymentFailure(id);
  assert.deepEqual([page.email?.step, page.email?.due, page.email?.to, page.email?.blocked], [1, true, "parent@example.invalid", null]);
  assert.match(page.email?.subject ?? "", /payment didn't go through/);

  // Not the live site: recorded, nothing emailed.
  const before = process.env.VERCEL_ENV;
  delete process.env.VERCEL_ENV;
  assert.deepEqual(await send(1), { ok: true, id });
  assert.equal(mailbox.sent.length, 0);
  let row = await db.paymentFailure.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([row.emailsSent, row.status, row.attempts], [1, "contacted", 1]);
  assert.ok(row.firstEmailAt);
  assert.match((await db.paymentFailureEvent.findFirstOrThrow({ where: { failureId: id, action: "email" } })).note, /not sent/);

  // The reminder waits 3 days after the first.
  const tooSoon = await send(2);
  assert.equal(tooSoon.ok, false);
  assert.match(tooSoon.ok ? "" : tooSoon.error, /reminder is due on/);
  await db.paymentFailure.update({ where: { id }, data: { firstEmailAt: new Date(Date.now() - 8 * 86_400_000) } });

  process.env.VERCEL_ENV = "production";
  try {
    mailbox.failing = true;
    const failed = await send(2);
    assert.equal(failed.ok, false, "a send the provider refuses");
    assert.equal((await db.paymentFailure.findUniqueOrThrow({ where: { id } })).emailsSent, 1, "records nothing");
    mailbox.failing = false;
    assert.deepEqual(await send(2), { ok: true, id });
    assert.deepEqual(await send(3), { ok: true, id });
    assert.deepEqual(mailbox.sent.map((m) => m.to), ["parent@example.invalid", "parent@example.invalid"]);
    assert.match(mailbox.sent[1].subject, /^Final notice/);
  } finally {
    if (before === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = before;
  }
  row = await db.paymentFailure.findUniqueOrThrow({ where: { id } });
  assert.deepEqual([row.emailsSent, row.attempts], [3, 3]);
  page = await data.getPaymentFailure(id);
  assert.equal(page.email, null, "all three sent");
  assert.equal((await send(3)).ok, false, "a fourth is refused");
  assert.equal(await db.auditLog.count({ where: { entityId: id, action: "email" } }), 3);

  // A payment whose swimmer has no email can't be emailed, and says why.
  workbook(["LW Churchfield", "Example Person", 31, "E/LWC2002", "MD01", "No Mandate", "LWC2002", null]);
  manager();
  await upload.uploadFailureSheet(form({ file: file("Email test 05.xlsx"), month: "2026-05", operationId: uuid() }));
  reception();
  const original = directory.byIds;
  directory.byIds = (async (ids: readonly string[]) => new Map([...(await original(ids))].map(([k, v]) => [k, { ...v, contactEmail: null }]))) as unknown as typeof original;
  try {
    const other = await data.getPaymentFailure((await failure("E/LWC2002")).id);
    assert.match(other.email?.blocked ?? "", /no valid email address/);
  } finally {
    directory.byIds = original;
  }
});
