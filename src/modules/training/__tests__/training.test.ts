import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { addMonthsIso } from "../shared/constants";
import { today } from "@/lib/format";

/** Training against a real (in-memory) Postgres: records and actions reach
 *  only the people a capability covers, the learner completes their own, a
 *  practical needs someone else's sign-off, and completion records the
 *  qualification the course grants. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions") & typeof import("../features/sign-off/server/actions");
let data: typeof import("../shared/data") & typeof import("../features/courses/server/data") & typeof import("../features/assignments/server/data") & typeof import("../features/sign-off/server/data") & typeof import("../features/expiring/server/data");
let self: typeof import("../features/me/server/mine");
let own: typeof import("../features/me/server/self");
const ORG = "org_leisureworld";
type GrantRow = { roleName: string; permissions: string[]; scopeKind: string; scopeId: string };
const state = { id: "maya", permissions: [] as string[], screens: [] as string[], grants: [] as GrantRow[] };
const TRAINER: GrantRow = { roleName: "Trainer", permissions: ["training.assign", "training.signoff"], scopeKind: "site", scopeId: "club_churchfield" };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: state.screens, primaryScreens: state.screens, grants: state.grants, authMethod: "password", authAt: Date.now() } };
}
class NotFound extends Error {}
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: (s: { user: { screens: string[] } }, screen: string) => s.user.screens.includes(screen),
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new NotFound("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const as = (id: string, permissions: string[] = [], grants: GrantRow[] = [], screens: string[] = permissions.length || grants.length ? ["training"] : []) =>
  Object.assign(state, { id, permissions, grants, screens });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  const club = await db.club.findFirstOrThrow({ where: { orgId: ORG } });
  await db.department.createMany({ data: [{ id: "d-aquatics", orgId: ORG, name: "Aquatics", clubId: club.id }, { id: "d-reception", orgId: ORG, name: "Reception" }] });
  for (const [id, dept] of [["maya", null], ["liam", "d-aquatics"], ["ava", "d-aquatics"], ["riley", "d-aquatics"], ["noah", "d-reception"]] as const) {
    await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "", primaryClubId: dept === "d-aquatics" ? "club_churchfield" : dept === "d-reception" ? "club_bishopstown" : null } });
    if (dept) await db.userDepartment.create({ data: { userId: id, departmentId: dept } });
  }
  await db.qualificationType.create({ data: { id: "qt-rescue", orgId: ORG, name: "Synthetic rescue award", validityMonths: 24 } });
  await db.qualificationType.create({ data: { id: "qt-safe", orgId: ORG, name: "Synthetic safeguarding", validityMonths: 12 } });
  actions = Object.assign({}, ...["courses", "assignments", "sign-off"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/actions.ts`, doubles())));
  data = Object.assign(serverModule<object>("src/modules/training/shared/data.ts", doubles()), ...["courses", "assignments", "sign-off", "expiring"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/data.ts`, doubles())));
  self = serverModule("src/modules/training/features/me/server/mine.ts", doubles());
  own = serverModule("src/modules/training/features/me/server/self.ts", doubles());
});
after(async () => { await fixture?.close(); });

let practical = "", online = "";
test("only training.manage builds the catalogue; names are unique", async () => {
  as("liam", [], [TRAINER]);
  assert.equal((await actions.saveCourse(null, { title: "Pool rescue", summary: "", content: "", requiresSignoff: true, grantsTypeId: "qt-rescue" })).ok, false);
  as("maya", ["training.manage"]);
  assert.equal((await actions.saveCourse(null, { title: "Pool rescue", summary: "Spinal and deep-water rescue", content: "Practise with a colleague.", requiresSignoff: true, grantsTypeId: "qt-rescue" })).ok, true);
  assert.equal((await actions.saveCourse(null, { title: "Safeguarding basics", summary: "", content: "Read the policy.", requiresSignoff: false, grantsTypeId: "qt-safe" })).ok, true);
  const dup = await actions.saveCourse(null, { title: "Pool rescue", summary: "", content: "", requiresSignoff: false, grantsTypeId: "" });
  assert.equal(dup.ok, false);
  const courses = await fixture.prisma.trainingCourse.findMany({ orderBy: { title: "asc" } });
  [practical, online] = [courses[0].id, courses[1].id];
});

test("a department trainer assigns only within their department, and never twice", async () => {
  as("liam", [], [TRAINER]);
  const denied = await actions.assignTraining(practical, ["ava", "noah"], "");
  assert.equal(denied.ok, false, "noah is in reception");
  assert.equal(await fixture.prisma.trainingAssignment.count(), 0, "nothing assigned on a refusal");
  assert.equal((await actions.assignTraining(practical, ["ava", "riley"], today())).ok, true);
  assert.equal((await actions.assignTraining(practical, ["ava"], "")).ok, false, "ava already has it open");
  assert.equal((await actions.assignTraining(online, ["ava"], "2020-01-01")).ok, false, "due dates are not in the past");
  assert.equal((await actions.assignTraining(online, ["ava"], "")).ok, true);
  const people = (await data.assignablePeople()).map((p) => p.id).sort();
  assert.deepEqual(people, ["ava", "liam", "riley"]);
});

test("records are scoped: the trainer sees the department, someone without a role sees nothing", async () => {
  as("maya", ["training.manage"]);
  await actions.assignTraining(online, ["noah"], "").then((r) => assert.equal(r.ok, false, "manage alone does not assign"));
  as("liam", [], [TRAINER]);
  const overview = await data.trainingOverview({ view: "all" });
  assert.deepEqual([...new Set(overview.rows.map((r) => r.user.id))].sort(), ["ava", "riley"]);
  await assert.rejects(data.personTraining("noah"), NotFound);
  as("noah");
  await assert.rejects(data.trainingOverview({}), /Training access/);
});

test("the learner completes their own; an online course records an unverified qualification with its validity", async () => {
  const mine = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: online } });
  as("riley");
  assert.equal((await own.completeTrainingFor({ id: state.id, name: state.id }, mine.id, "")).ok, false, "not riley's");
  await assert.rejects(self.myAssignment(mine.id), NotFound);
  as("ava");
  assert.equal((await own.completeTrainingFor({ id: state.id, name: state.id }, mine.id, "Read it")).ok, true);
  assert.equal((await own.completeTrainingFor({ id: state.id, name: state.id }, mine.id, "")).ok, false, "already finished");
  const row = await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: mine.id } });
  assert.equal(row.status, "COMPLETED");
  const q = await fixture.prisma.qualification.findUniqueOrThrow({ where: { id: row.qualificationId! } });
  assert.equal(q.typeId, "qt-safe");
  assert.equal(q.verifiedById, null);
  assert.equal(q.expiresOn?.toISOString().slice(0, 10), addMonthsIso(today(), 12));
});

test("a practical waits for someone else's sign-off; it can be sent back, then signed off once", async () => {
  const ava = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: practical } });
  const liamOwn = await fixture.prisma.trainingAssignment.create({ data: { orgId: ORG, courseId: practical, userId: "liam", assignedByName: "maya", status: "SUBMITTED", submittedAt: new Date() } });
  as("ava");
  assert.equal((await own.completeTrainingFor({ id: state.id, name: state.id }, ava.id, "Free on Tuesday")).ok, true);
  assert.equal((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: ava.id } })).status, "SUBMITTED");
  as("liam", [], [TRAINER]);
  const queue = await data.signoffQueue();
  assert.deepEqual(queue.rows.map((r) => r.user.id), ["ava"], "never their own");
  assert.equal((await actions.signOffTraining(liamOwn.id, "")).ok, false);
  assert.equal((await actions.returnForPractice(ava.id, "")).ok, false, "a reason is required");
  assert.equal((await actions.returnForPractice(ava.id, "Work on the spinal roll")).ok, true);
  assert.equal((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: ava.id } })).status, "ASSIGNED");
  as("ava");
  await own.completeTrainingFor({ id: state.id, name: state.id }, ava.id, "Practised");
  as("liam", [], [TRAINER]);
  assert.equal((await actions.signOffTraining(ava.id, "Watched at the Tuesday session")).ok, true);
  assert.equal((await actions.signOffTraining(ava.id, "")).ok, false, "decided once");
  const done = await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: ava.id } });
  assert.equal(done.signedOffById, "liam");
  const q = await fixture.prisma.qualification.findUniqueOrThrow({ where: { id: done.qualificationId! } });
  assert.equal(q.verifiedById, "liam");
  assert.equal(q.expiresOn?.toISOString().slice(0, 10), addMonthsIso(today(), 24));
  assert.ok(await fixture.prisma.auditLog.count({ where: { entity: "TrainingAssignment", action: "sign-off" } }) === 1);
});

test("expiring qualifications list the renewal course, and a newer certificate takes a person off", async () => {
  const soon = new Date(); soon.setUTCDate(soon.getUTCDate() + 10);
  await fixture.prisma.qualification.create({ data: { orgId: ORG, userId: "riley", typeId: "qt-rescue", issuedOn: new Date("2024-01-01"), expiresOn: soon } });
  await fixture.prisma.qualification.create({ data: { orgId: ORG, userId: "ava", typeId: "qt-rescue", issuedOn: new Date("2024-01-01"), expiresOn: soon } });
  await fixture.prisma.qualification.create({ data: { orgId: ORG, userId: "noah", typeId: "qt-rescue", issuedOn: new Date("2024-01-01"), expiresOn: soon } });
  as("liam", [], [TRAINER]);
  const { rows } = await data.expiringQualifications();
  assert.deepEqual(rows.map((r) => r.userId), ["riley"], "ava renewed today; noah is outside the department");
  assert.equal(rows[0].renewal?.courseId, practical);
  assert.equal(rows[0].renewal?.assigned, true, "riley already has the practical open");
});

test("the expiring list filters by position and lists who has never held what their position needs", async () => {
  const db = fixture.prisma;
  await db.position.create({ data: { id: "pos-guard", orgId: ORG, name: "Synthetic lifeguard", requires: { create: [{ typeId: "qt-rescue" }, { typeId: "qt-safe" }] } } });
  await db.user.update({ where: { id: "riley" }, data: { positionId: "pos-guard", siteIds: ["club_churchfield"] } });
  as("liam", [], [TRAINER]);
  const all = await data.expiringQualifications();
  assert.deepEqual(all.missing.map((m) => [m.userId, m.lacking]), [["riley", ["Synthetic safeguarding"]]], "expiring rescue is listed above, not as missing");
  assert.deepEqual((await data.expiringQualifications({ position: "pos-guard" })).rows.map((r) => r.userId), ["riley"]);
  const elsewhere = await data.expiringQualifications({ site: "club_bishopstown" });
  assert.equal(elsewhere.rows.length + elsewhere.missing.length, 0, "riley works only at Churchfield");
  await db.user.update({ where: { id: "riley" }, data: { positionId: null, siteIds: [] } });
});

test("self-service reads return only the person's own training", async () => {
  const riley = await self.myTraining("riley");
  assert.deepEqual(riley.map((r) => r.course.title), ["Pool rescue"]);
  const ava = await self.myTraining("ava");
  assert.ok(ava.every((r) => r.state === "completed"), "Ava's training is all done");
  assert.equal(ava.length, 2);
});

test("cancelling needs assign scope for that person and a reason", async () => {
  const riley = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "riley", status: "ASSIGNED" } });
  as("maya", ["training.manage"]);
  await assert.rejects(actions.cancelAssignment(riley.id, "No longer teaching"));
  as("liam", [], [TRAINER]);
  assert.equal((await actions.cancelAssignment(riley.id, "")).ok, false);
  assert.equal((await actions.cancelAssignment(riley.id, "No longer teaching")).ok, true);
  assert.equal((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: riley.id } })).status, "CANCELLED");
});
