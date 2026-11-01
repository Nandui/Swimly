import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { createHrTestDatabase } from "@/test/hr-database";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";

/** HR and performance against real (in-memory) Postgres for both databases:
 *  restricted keys never reach administrators, a department HR role reaches
 *  only its department, private notes stay with their author, drafts with
 *  their reviewer, the person sees only what is shared, a PIN or stale session
 *  is refused, and every read is logged. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let hr: Awaited<ReturnType<typeof createHrTestDatabase>>;
let actions: typeof import("../features/person/server/actions") & typeof import("../features/reviews/server/actions");
let records: typeof import("../shared/records") & typeof import("../features/team/server/data") & typeof import("../features/person/server/data") & typeof import("../features/reviews/server/data") & typeof import("../features/activity/server/data");
let mine: typeof import("@/modules/hr/features/me/server/mine");
let self: typeof import("@/modules/hr/features/me/server/self");
let exporter: typeof import("@/modules/hr/features/export/server/export");
let home: typeof import("@/modules/hr/features/details-requests/server/home");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; scopeKind: string; scopeId: string };
const state = { id: "liam", permissions: [] as string[], screens: [] as string[], grants: [] as GrantRow[], superadmin: false, authMethod: "password", authAt: Date.now() as number | null };
const HR_LEAD: GrantRow = { roleName: "HR lead", permissions: ["hr.notes.write", "hr.reviews.write"], scopeKind: "site", scopeId: "club_churchfield" };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: state.superadmin, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions,
    screens: state.screens, primaryScreens: state.screens, grants: state.grants, authMethod: state.authMethod, authAt: state.authAt } };
}
class NotFound extends Error {}
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/modules/hr/shared/database": hr.module,
    "@/lib/authz": {
      AuthorizationError: class AuthorizationError extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: (s: { user: { screens: string[] } }, screen: string) => s.user.screens.includes(screen),
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); }, redirect: (to: string) => { throw new Error(`redirect ${to}`); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
    // Other modules' parts of the personal file (Rota's absences), by person.
    "@/modules/contributions": { subjectRecords: async () => ({ training: [] }), personFile: async (userId: string) => [{ id: "rota.absences", heading: "Absences and returns to work", summary: "Synthetic", entries: [{ id: `a-${userId}`, title: "Sickness", detail: "", on: "2026-10-01" }] }] },
  };
}
const as = (id: string, extra: Partial<typeof state> = {}) =>
  Object.assign(state, { id, permissions: [], screens: [], grants: [], superadmin: false, authMethod: "password", authAt: Date.now() }, extra);

before(async () => {
  fixture = await isolatedPrisma();
  hr = await createHrTestDatabase();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  const club = await db.club.findFirstOrThrow({ where: { orgId: ORG } });
  await db.department.createMany({ data: [{ id: "d-aquatics", orgId: ORG, name: "Aquatics", clubId: club.id }, { id: "d-reception", orgId: ORG, name: "Reception" }] });
  for (const [id, dept] of [["alex", null], ["admin", null], ["liam", "d-aquatics"], ["ava", "d-aquatics"], ["riley", "d-aquatics"], ["noah", "d-reception"]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, primaryClubId: dept === "d-aquatics" ? "club_churchfield" : dept === "d-reception" ? "club_bishopstown" : null } });
    if (dept) await db.userDepartment.create({ data: { userId: id, departmentId: dept } });
  }
  const d = doubles();
  actions = Object.assign({}, ...["person", "reviews"].map((f) => serverModule<object>(`src/modules/hr/features/${f}/server/actions.ts`, d)));
  records = Object.assign(serverModule<object>("src/modules/hr/shared/records.ts", d), ...["team", "person", "reviews", "activity"].map((f) => serverModule<object>(`src/modules/hr/features/${f}/server/data.ts`, d)));
  mine = serverModule("src/modules/hr/features/me/server/mine.ts", d);
  self = serverModule("src/modules/hr/features/me/server/self.ts", d);
  exporter = serverModule("src/modules/hr/features/export/server/export.ts", d);
  home = serverModule("src/modules/hr/features/details-requests/server/home.ts", d);
});
after(async () => { await hr?.close(); await fixture?.close(); });

test("administrators never hold HR keys, so they cannot write or read HR records", async () => {
  as("admin", { permissions: ["staff.manage", "roles.manage"], screens: ["staff"] });
  assert.equal((await actions.addNote("ava", "Synthetic note text", "record")).ok, false);
  await assert.rejects(records.hrPerson("ava"), /HR access/);
});

let privateNote = "", sharedNote = "";
test("a site HR lead writes only for the people at their site, never for themselves", async () => {
  as("liam", { grants: [HR_LEAD] });
  assert.equal((await actions.addNote("noah", "Synthetic note text", "record")).ok, false, "reception is outside the department");
  assert.equal((await actions.addNote("liam", "Synthetic note text", "record")).ok, false, "their own record");
  assert.equal((await actions.addNote("ava", "Synthetic private observation", "private")).ok, true);
  assert.equal((await actions.addNote("ava", "Synthetic note on the record", "record")).ok, true);
  assert.equal((await actions.addNote("ava", "Synthetic praise shared with Ava", "subject")).ok, true);
  const notes = await hr.db.query<{ id: string; visibility: string }>("SELECT id, visibility FROM notes ORDER BY created_at");
  privateNote = notes.find((n) => n.visibility === "private")!.id;
  sharedNote = notes.find((n) => n.visibility === "subject")!.id;
  assert.equal((await hr.db.query("SELECT 1 FROM audit_events")).length, 3);
});

test("a PIN session or a stale password is refused until the password is confirmed", async () => {
  as("liam", { grants: [HR_LEAD], authMethod: "pin" });
  assert.equal((await actions.addNote("ava", "Synthetic note text", "record")).ok, false);
  await assert.rejects(records.hrPerson("ava"), /Confirm your password/);
  as("liam", { grants: [HR_LEAD], authAt: Date.now() - 60 * 60 * 1000 });
  await assert.rejects(records.hrPerson("ava"), /Confirm your password/);
});

let draft = "";
test("private notes stay with the author; drafts stay with the reviewer; every read is logged", async () => {
  as("liam", { grants: [HR_LEAD] });
  const saved = await actions.saveReview(null, "ava", { period: "2026 annual review", summary: "", strengths: "", goals: "", overall: "" });
  assert.equal(saved.ok, true);
  draft = saved.id!;
  const liamView = await records.hrPerson("ava");
  assert.equal(liamView.notes.length, 3);
  assert.deepEqual(liamView.file.map((s) => s.entries[0].id), ["a-ava"], "the personal file from other modules is on the record");
  assert.equal(liamView.reviews.length, 1);
  // A second HR reader for Aquatics sees neither the private note nor the draft.
  as("riley", { grants: [{ ...HR_LEAD, permissions: ["hr.records.read"] }] });
  const rileyView = await records.hrPerson("ava");
  assert.deepEqual(rileyView.notes.map((n) => n.visibility).sort(), ["record", "subject"]);
  assert.equal(rileyView.reviews.length, 0);
  await assert.rejects(records.hrReview(draft), NotFound);
  assert.equal(rileyView.canWriteNotes, false);
  const reads = await hr.db.query<{ actor_id: string }>("SELECT actor_id FROM access_events WHERE entity='HrRecord'");
  assert.deepEqual(reads.map((r) => r.actor_id).sort(), ["liam", "riley"]);
  // The people list shows only the department.
  const list = await records.hrPeople();
  assert.deepEqual(list.people.map((p) => p.id).sort(), ["ava", "liam", "riley"]);
});

test("a shared review is locked; the person sees only what is shared and acknowledges it themselves", async () => {
  as("ava");
  let own = await mine.mySharedHr("ava", ORG);
  assert.deepEqual(own.notes.map((n) => n.id), [sharedNote], "never the private or record notes");
  assert.equal(own.reviews.length, 0, "never a draft");
  as("liam", { grants: [HR_LEAD] });
  assert.equal((await actions.shareReview(draft)).ok, false, "a summary is required");
  assert.equal((await actions.saveReview(draft, "ava", { period: "2026 annual review", summary: "Synthetic summary", strengths: "Calm on poolside", goals: "Lead a class", overall: "meets" })).ok, true);
  assert.equal((await actions.shareReview(draft)).ok, true);
  assert.equal((await actions.saveReview(draft, "ava", { period: "Changed", summary: "x", strengths: "", goals: "", overall: "" })).ok, false, "locked once shared");
  // Acknowledging is the person's own action, from Turnfin Me (the staff API
  // checks the fresh confirmation); only the subject's own review moves.
  assert.equal((await self.acknowledgeReviewFor({ id: "riley", name: "riley", orgId: ORG }, draft, "")).ok, false, "only the person themselves");
  as("ava");
  own = await mine.mySharedHr("ava", ORG);
  assert.equal(own.reviews[0].status, "shared");
  assert.equal((await self.acknowledgeReviewFor({ id: "ava", name: "ava", orgId: ORG }, draft, "Thanks, agreed")).ok, true);
  assert.equal((await self.acknowledgeReviewFor({ id: "ava", name: "ava", orgId: ORG }, draft, "again")).ok, false);
  assert.equal((await mine.mySharedHr("ava", ORG)).reviews[0].subjectComment, "Thanks, agreed");
});

test("only the author withdraws a note; the subject export is superadmin-only and includes everything", async () => {
  as("riley", { grants: [HR_LEAD] });
  assert.equal((await actions.withdrawNote(privateNote, "Written in error")).ok, false, "not riley's note");
  as("liam", { grants: [HR_LEAD] });
  assert.equal((await actions.withdrawNote(privateNote, "Written in error")).ok, true);
  assert.equal((await records.hrPerson("ava")).notes.length, 2);
  as("admin", { permissions: ["staff.manage", "roles.manage"] });
  await assert.rejects(exporter.subjectExport("ava"), /superadmin/);
  as("alex", { superadmin: true, authMethod: "pin" });
  await assert.rejects(exporter.subjectExport("ava"), /Confirm it's you/);
  as("alex", { superadmin: true });
  const data = await exporter.subjectExport("ava");
  assert.equal(data?.hr.notes.length, 3, "withdrawn and private notes included");
  assert.ok(data?.hr.notes.some((n) => n.withdrawnAt));
  assert.equal(data?.hr.reviews.length, 1);
  assert.ok((data?.hr.whoReadThisRecord.length ?? 0) >= 2);
  assert.equal(data?.personalFile[0].id, "rota.absences", "and in the export");
  assert.deepEqual((data as { training?: unknown } | null)?.training, [], "other modules' records under their own key");
});

test("Home counts details changes from Turnfin Me only for people whose details the viewer keeps", async () => {
  const viewer = (anywhere: string[], isSuperadmin = false) => ({ id: state.id, name: state.id, permissions: anywhere, anywhere, isSuperadmin });
  await fixture.prisma.staffDetailChangeRequest.createMany({ data: [
    { orgId: ORG, userId: "ava", proposed: { phone: "000 0000" }, message: "Synthetic new number" },
    { orgId: ORG, userId: "noah", proposed: { phone: "000 0001" }, message: "Synthetic new number" },
  ] });
  as("admin", { permissions: ["staff.manage", "roles.manage"], screens: ["staff"] });
  assert.deepEqual(await home.hrHomeItems(viewer(["staff.manage", "roles.manage"])), [], "administrators never inherit HR");
  as("liam", { grants: [{ roleName: "HR lead", permissions: ["hr.details.write"], scopeKind: "site", scopeId: "club_churchfield" }] });
  const [lead] = await home.hrHomeItems(viewer(["hr.details.write"]));
  assert.equal(lead.count, 1, "Ava at Churchfield, not Noah at Bishopstown");
  assert.equal(lead.href, "/hr/details-requests");
  assert.equal(lead.attention, true);
  as("alex", { superadmin: true });
  assert.equal((await home.hrHomeItems(viewer([], true)))[0].count, 2, "a superadmin keeps everyone's details");
  await fixture.prisma.staffDetailChangeRequest.updateMany({ where: { userId: "ava" }, data: { status: "APPLIED" } });
  as("liam", { grants: [{ roleName: "HR lead", permissions: ["hr.details.write"], scopeKind: "site", scopeId: "club_churchfield" }] });
  const [none] = await home.hrHomeItems(viewer(["hr.details.write"]));
  assert.equal(none.count, 0);
  assert.equal(none.attention, false, "shown, but not asking for attention, when nothing waits");
});

test("reading your own HR record in Turnfin Me is logged like every HR read, against you alone", async () => {
  const before = (await hr.db.query("SELECT 1 FROM access_events")).length;
  await mine.logOwnHrRead({ id: "ava", name: "ava", orgId: ORG });
  const rows = await hr.db.query<{ actor_id: string; subject_user_ids: string[]; entity: string; purpose: string }>("SELECT actor_id, subject_user_ids, entity, purpose FROM access_events ORDER BY id DESC LIMIT 1");
  assert.equal((await hr.db.query("SELECT 1 FROM access_events")).length, before + 1);
  assert.deepEqual(rows[0], { actor_id: "ava", subject_user_ids: ["ava"], entity: "HrRecord", purpose: "own HR record (Turnfin Me)" });
});

test("HR's front door gives Turnfin Me only the person's own shared records, in their own organisation, and audits acknowledging", async () => {
  const front = serverModule<typeof import("@/modules/hr")>("src/modules/hr/index.ts", doubles());
  // The same person id in another organisation is another person's record.
  await hr.db.query("INSERT INTO notes (id, org_id, subject_user_id, author_id, author_name, visibility, body) VALUES ('n-elsewhere', 'org_elsewhere', 'ava', 'x', 'x', 'subject', 'Synthetic note elsewhere')");
  await hr.db.query("INSERT INTO reviews (id, org_id, subject_user_id, reviewer_id, reviewer_name, period, status, shared_at) VALUES ('r-elsewhere', 'org_elsewhere', 'ava', 'x', 'x', 'Elsewhere 2026', 'shared', now())");
  const own = await front.mySharedHr("ava", ORG);
  assert.deepEqual(own.notes.map((n) => n.id), [sharedNote]);
  assert.deepEqual(own.reviews.map((r) => r.id), [draft]);
  assert.deepEqual((await front.mySharedHr("ava", "org_elsewhere")).reviews.map((r) => r.id), ["r-elsewhere"]);
  assert.deepEqual(await front.mySharedHr("noah", ORG), { notes: [], reviews: [] }, "nothing shared, nothing shown");

  assert.equal((await front.acknowledgeReviewFor({ id: "ava", name: "ava", orgId: ORG }, "r-elsewhere", "")).ok, false, "another organisation's review");
  const audit = await hr.db.query<{ actor_id: string; entity: string; subject_user_id: string; summary: string }>("SELECT actor_id, entity, subject_user_id, summary FROM audit_events WHERE action='acknowledge' AND entity_id=$1", [draft]);
  assert.deepEqual(audit, [{ actor_id: "ava", entity: "HrReview", subject_user_id: "ava", summary: "Acknowledged the review 2026 annual review" }], "acknowledged once, audited once");
  assert.equal((await front.acknowledgeReviewFor({ id: "ava", name: "ava", orgId: "org_elsewhere" }, "r-elsewhere", `  ${"x".repeat(2100)}  `)).ok, true);
  const [elsewhere] = await front.mySharedHr("ava", "org_elsewhere").then((r) => r.reviews);
  assert.equal(elsewhere.subjectComment.length, 2000, "the comment is trimmed and kept to 2000 letters");

  as("liam", { grants: [HR_LEAD] });
  assert.equal((await actions.withdrawNote(sharedNote, "Synthetic: shared in error")).ok, true);
  assert.deepEqual((await front.mySharedHr("ava", ORG)).notes, [], "a withdrawn note leaves Turnfin Me");

  const reads = (await hr.db.query("SELECT 1 FROM access_events WHERE actor_id='ava'")).length;
  await front.logOwnHrRead({ id: "ava", name: "ava", orgId: ORG });
  assert.equal((await hr.db.query("SELECT 1 FROM access_events WHERE actor_id='ava'")).length, reads + 1);
});

test("HR is on only when its own database is set, and refuses one shared with Turnfin", () => {
  const { hrConfigured } = serverModule<typeof import("@/modules/hr")>("src/modules/hr/shared/database.ts", { "server-only": {} });
  const keys = ["HR_DATABASE_URL", "HR_DIRECT_URL", "HR_DB_DATABASE_URL", "HR_DB_DATABASE_URL_UNPOOLED", "DATABASE_URL", "DIRECT_URL", "DATABASE_URL_UNPOOLED", "DOCS_DATABASE_URL", "DOCS_DIRECT_URL"] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  try {
    for (const k of keys) delete process.env[k];
    assert.equal(hrConfigured(), false, "unset: HR says it is not set up, and nothing else is affected");
    process.env.DATABASE_URL = "postgres://synthetic@main.example.invalid/turnfin";
    process.env.HR_DATABASE_URL = "postgres://synthetic@hr.example.invalid/hr";
    assert.equal(hrConfigured(), true);
    process.env.HR_DATABASE_URL = "postgres://synthetic@main.example.invalid/turnfin";
    assert.throws(() => hrConfigured(), /own database/);
  } finally {
    for (const k of keys) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
});
