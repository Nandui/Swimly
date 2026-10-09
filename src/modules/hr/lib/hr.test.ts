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
let actions: typeof import("./actions");
let records: typeof import("./records");
let mine: typeof import("./mine");
let self: typeof import("./self");
let exporter: typeof import("./export");
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
    "@/modules/hr/lib/database": hr.module,
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
    "@/modules/server": { subjectRecords: async () => ({ training: [] }), personFile: async (userId: string) => [{ id: "rota.absences", heading: "Absences and returns to work", summary: "Synthetic", entries: [{ id: `a-${userId}`, title: "Sickness", detail: "", on: "2026-10-01" }] }] },
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
  actions = serverModule("src/modules/hr/lib/actions.ts", d);
  records = serverModule("src/modules/hr/lib/records.ts", d);
  mine = serverModule("src/modules/hr/lib/mine.ts", d);
  self = serverModule("src/modules/hr/lib/self.ts", d);
  exporter = serverModule("src/modules/hr/lib/export.ts", d);
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
  await assert.rejects(exporter.subjectExport("ava"), /Confirm your password/);
  as("alex", { superadmin: true });
  const data = await exporter.subjectExport("ava");
  assert.equal(data?.hr.notes.length, 3, "withdrawn and private notes included");
  assert.ok(data?.hr.notes.some((n) => n.withdrawnAt));
  assert.equal(data?.hr.reviews.length, 1);
  assert.ok((data?.hr.whoReadThisRecord.length ?? 0) >= 2);
  assert.equal(data?.personalFile[0].id, "rota.absences", "and in the export");
  assert.deepEqual((data as { training?: unknown } | null)?.training, [], "other modules' records under their own key");
});
