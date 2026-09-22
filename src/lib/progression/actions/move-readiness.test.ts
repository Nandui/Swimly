import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import type { ActionResult } from "@/lib/action-result";

let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let actions: typeof import("./assess");
let enrolments: typeof import("@/lib/enrolment/actions/enrolment");
let read: typeof import("@/lib/enrolment/data/awaiting-moves").getAwaitingMoves;
let progress: typeof import("@/lib/progression/data/progress").getClassProgress;
const date = new Date("2026-09-21T00:00:00Z");
const state = { clubId: "club_bishopstown", permission: true, instructor: true, authenticated: true, auditFails: false, failedAction: "" };
const invalidated: string[] = [];
let serial = 0;

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.user.create({ data: { id: "move-teacher", name: "Alex Example", email: "move@example.test" } });
  await db.programme.create({ data: { id: "move-programme", clubId: state.clubId, name: "Swimming example" } });
  await db.programme.create({ data: { id: "move-copy", clubId: "club_churchfield", name: "Legacy swimming", sharedWithId: "move-programme" } });
  await db.level.create({ data: { id: "move-level", programmeId: "move-programme", name: "Turtles" } });
  await db.level.create({ data: { id: "move-level-copy", programmeId: "move-copy", name: "Legacy Turtles", sharedWithId: "move-level" } });
  await db.level.create({ data: { id: "move-next", programmeId: "move-programme", name: "Dolphins", sortOrder: 2 } });
  await db.competency.create({ data: { id: "move-skill", levelId: "move-level", name: "Float safely" } });
  await db.competency.create({ data: { id: "move-skill-copy", levelId: "move-level-copy", name: "Old float", sharedWithId: "move-skill" } });
  const session = { user: { id: "move-teacher", name: "Alex Example" } };
  const doubles = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      requireSession: async () => { if (!state.authenticated) throw Error("sign in required"); return session; },
      requirePermission: async () => { if (!state.permission) throw Error("permission denied"); return session; },
      canSee: (_: unknown, screen: string) => screen === "instructor" ? state.instructor : false,
      can: () => state.permission,
    },
    "@/lib/clubs/current": { currentClubId: async () => state.clubId, currentClubIdIfAny: async () => state.clubId },
    "@/lib/format": { ...await import("@/lib/format"), today: () => "2026-09-21" },
    "@/lib/audit": { logAudit: async (input: { action: string }, tx: typeof db) => {
      if (state.auditFails || state.failedAction === input.action) throw Error("audit failure");
      await tx.auditLog.create({ data: input as Parameters<typeof db.auditLog.create>[0]["data"] });
    } },
    "next/cache": { revalidatePath: (path: string) => invalidated.push(path) },
    react: { cache: (fn: unknown) => fn },
  };
  actions = serverModule("src/lib/progression/actions/assess.ts", doubles);
  enrolments = serverModule("src/lib/enrolment/actions/enrolment.ts", doubles);
  read = serverModule<typeof import("@/lib/enrolment/data/awaiting-moves")>("src/lib/enrolment/data/awaiting-moves.ts", doubles).getAwaitingMoves;
  progress = serverModule<typeof import("@/lib/progression/data/progress")>("src/lib/progression/data/progress.ts", doubles).getClassProgress;
});
beforeEach(() => { Object.assign(state, { clubId: "club_bishopstown", permission: true, instructor: true, authenticated: true, auditFails: false, failedAction: "" }); invalidated.length = 0; });
after(async () => { await fixture?.close(); });

async function swimmer(options: { started?: boolean; achieved?: boolean; legacy?: boolean } = {}) {
  const id = `move-example-${++serial}`, db = fixture.prisma;
  await db.student.create({ data: { id, clubId: "club_bishopstown", firstName: id, lastName: "Example", memberNumber: `TEST-${serial}`, contactEmail: "guardian@example.test", medicalNotes: "Never return in queue" } });
  const courseId = `class-${id}`;
  await db.course.create({ data: { id: courseId, clubId: "club_bishopstown", levelId: options.legacy ? "move-level-copy" : "move-level", dayOfWeek: "MONDAY", startMinutes: 900, durationMinutes: 30 } });
  const place = await db.enrolment.create({ data: { studentId: id, courseId, levelId: "move-level", programmeId: "move-programme", startedOn: new Date("2026-09-01") } });
  if (options.started !== false) await db.classCover.create({ data: { courseId, date, coverById: "move-teacher", coverByName: "Original teacher" } });
  if (options.achieved !== false) await db.competencyResult.create({ data: { studentId: id, competencyId: options.legacy ? "move-skill-copy" : "move-skill", status: "ACHIEVED", assessedOn: date, assessedByName: "Previous teacher" } });
  const input = { studentId: id, levelId: "move-level", note: "Ready for more distance", overrideReason: "", readyToMove: true, teaching: { courseId, date: "2026-09-21" } };
  return { id, place, courseId, input };
}
function rejected(result: ActionResult, message: RegExp) { assert.equal(result.ok, false); if (!result.ok) assert.match(result.error, message); }

test("explicit confirmation completes the shared level and queues the original active place with an audit", async () => {
  const f = await swimmer({ legacy: true });
  assert.equal((await read({ q: f.id })).total, 0);
  assert.deepEqual(await actions.confirmLevelCompletion(f.input), { ok: true });
  const queue = await read({ q: f.id });
  assert.equal(queue.total, 1); assert.equal(queue.items[0].id, f.place.id);
  assert.equal(queue.items[0].readyToMoveByName, "Alex Example");
  assert.equal(queue.items[0].readyToMoveNote, f.input.note);
  assert.equal(queue.items[0].reviewReason, null); assert.equal(queue.items[0].nextLevel?.id, "move-next");
  assert.equal("medicalNotes" in queue.items[0].student, false);
  assert.equal((await fixture.prisma.levelCompletion.findFirst({ where: { studentId: f.id } }))?.levelId, "move-level");
  assert.equal((await progress(f.courseId))?.swimmers[0].moveReadinessCurrent, true);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: f.place.id, action: "ready-to-move" } }), 1);
  assert.ok(invalidated.includes("/awaiting-enrolment"));
});

test("every saved competency is required, including for staff allowed to override gaps", async () => {
  const f = await swimmer({ achieved: false });
  rejected(await actions.confirmLevelCompletion({ ...f.input, overrideReason: "Cannot bypass readiness" }), /Every competency/);
  assert.equal(await fixture.prisma.levelCompletion.count({ where: { studentId: f.id } }), 0);
  assert.equal((await read({ q: f.id })).total, 0);
});

test("readiness requires teaching access, a started class, the right site and a current place", async () => {
  const f = await swimmer({ started: false });
  rejected(await actions.confirmLevelCompletion(f.input), /Start this class/);
  await fixture.prisma.classCover.create({ data: { courseId: f.courseId, date, coverByName: "Deleted instructor", coverById: null } });
  state.instructor = false;
  rejected(await actions.confirmLevelCompletion(f.input), /Instructor access/);
  state.instructor = true; state.clubId = "club_churchfield";
  rejected(await actions.confirmLevelCompletion(f.input), /no longer active/);
  state.clubId = "club_bishopstown";
  rejected(await actions.confirmLevelCompletion({ ...f.input, teaching: undefined }), /Open.*Instructor/);
  await fixture.prisma.enrolment.update({ where: { id: f.place.id }, data: { status: "TRANSFERRED" } });
  rejected(await actions.confirmLevelCompletion(f.input), /no longer in/);
  state.permission = false;
  await assert.rejects(actions.confirmLevelCompletion(f.input), /permission denied/);
  await assert.rejects(actions.cancelInstructorMoveReadiness(f.input), /permission denied/);
});

test("readiness is individual within a class and achievements at another level cannot qualify a swimmer", async () => {
  const ready = await swimmer(), learning = await swimmer({ achieved: false });
  const db = fixture.prisma;
  await db.enrolment.update({ where: { id: learning.place.id }, data: { courseId: ready.courseId } });
  const otherSkill = await db.competency.create({ data: { levelId: "move-next", name: "A different level's competency" } });
  await db.competencyResult.create({ data: { studentId: learning.id, competencyId: otherSkill.id, status: "ACHIEVED", assessedOn: date, assessedByName: "Previous teacher" } });
  const learningInput = { ...learning.input, teaching: ready.input.teaching };
  assert.equal((await actions.confirmLevelCompletion(ready.input)).ok, true);
  rejected(await actions.confirmLevelCompletion(learningInput), /Every competency/);
  assert.equal((await read({ q: ready.id })).total, 1);
  assert.equal((await read({ q: learning.id })).total, 0);
  const classmates = (await progress(ready.courseId))!.swimmers;
  assert.equal(classmates.find(s => s.student.id === ready.id)?.moveReadinessCurrent, true);
  assert.equal(classmates.find(s => s.student.id === learning.id)?.readyToMoveAt, null);
  await actions.saveInstructorAssessment({ ...ready.input.teaching, levelId: "move-level", marks: [{ studentId: learning.id, competencyId: "move-skill", status: "ACHIEVED" }] });
  assert.equal((await read({ q: learning.id })).total, 0, "achieving the level does not automatically queue a swimmer");
  assert.equal((await actions.confirmLevelCompletion(learningInput)).ok, true);
  assert.equal((await read({ q: learning.id })).total, 1);
  await db.competencyResult.deleteMany({ where: { competencyId: otherSkill.id } });
  await db.competency.delete({ where: { id: otherSkill.id } });
});

test("changed levels, inactive swimmers and due withdrawals cannot be queued", async () => {
  const f = await swimmer();
  await fixture.prisma.course.update({ where: { id: f.courseId }, data: { levelId: "move-next" } });
  rejected(await actions.confirmLevelCompletion(f.input), /class level has changed/);
  await fixture.prisma.course.update({ where: { id: f.courseId }, data: { levelId: "move-level" } });
  await fixture.prisma.student.update({ where: { id: f.id }, data: { status: "INACTIVE" } });
  rejected(await actions.confirmLevelCompletion(f.input), /no longer has an active place/);
  await fixture.prisma.student.update({ where: { id: f.id }, data: { status: "ACTIVE" } });
  await fixture.prisma.enrolment.update({ where: { id: f.place.id }, data: { scheduledEndOn: date } });
  rejected(await actions.confirmLevelCompletion(f.input), /no longer has an active place/);
});

test("retries and concurrent confirmations create one queue entry and preserve the first attribution", async () => {
  const f = await swimmer();
  const results = await Promise.all([actions.confirmLevelCompletion(f.input), actions.confirmLevelCompletion({ ...f.input, note: "A retry" })]);
  assert.ok(results.every(r => r.ok));
  assert.equal((await read({ q: f.id })).total, 1);
  assert.equal((await read({ q: f.id })).items[0].readyToMoveNote, f.input.note);
  assert.equal(await fixture.prisma.levelCompletion.count({ where: { studentId: f.id } }), 1);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: f.place.id, action: "ready-to-move" } }), 1);
});

test("an already-completed level can be queued; undo preserves progress and allows reconfirmation", async () => {
  const f = await swimmer();
  assert.equal((await actions.confirmLevelCompletion({ ...f.input, readyToMove: false })).ok, true);
  assert.equal((await read({ q: f.id })).total, 0);
  assert.equal((await actions.confirmLevelCompletion(f.input)).ok, true);
  assert.equal((await actions.cancelInstructorMoveReadiness(f.input)).ok, true);
  assert.equal((await actions.cancelInstructorMoveReadiness(f.input)).ok, true);
  assert.equal((await read({ q: f.id })).total, 0);
  assert.equal(await fixture.prisma.levelCompletion.count({ where: { studentId: f.id } }), 1);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: f.place.id, action: "cancel-move-readiness" } }), 1);
  assert.equal((await actions.confirmLevelCompletion(f.input)).ok, true);
});

test("competency corrections and curriculum changes keep the handoff visible but flag it for review", async () => {
  const f = await swimmer(); await actions.confirmLevelCompletion(f.input);
  await actions.saveInstructorAssessment({ ...f.input.teaching, levelId: "move-level", marks: [{ studentId: f.id, competencyId: "move-skill", status: "WORKING_ON" }] });
  assert.match((await read({ q: f.id })).items[0].reviewReason!, /Progress has changed/);
  assert.equal((await progress(f.courseId))?.swimmers[0].moveReadinessCurrent, false);
  await fixture.prisma.course.update({ where: { id: f.courseId }, data: { levelId: "move-next" } });
  assert.match((await read({ q: f.id })).items[0].reviewReason!, /class level or curriculum has changed/);
});

test("the queue follows the source site and a real cross-site transfer resolves it without copying readiness", async () => {
  const f = await swimmer(); await actions.confirmLevelCompletion(f.input);
  state.clubId = "club_churchfield";
  assert.equal((await read({ q: f.id })).total, 0);
  const to = await fixture.prisma.course.create({ data: { clubId: state.clubId, levelId: "move-next", dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, capacity: 10 } });
  const review = await enrolments.transferEnrolment(f.place.id, to.id);
  assert.equal(review.ok, false);
  assert.equal((await enrolments.transferEnrolment(f.place.id, to.id, "", { choice: "move", ids: [f.place.id, to.id] })).ok, true);
  const newPlace = await fixture.prisma.enrolment.findFirst({ where: { studentId: f.id, status: "ACTIVE" } });
  assert.equal(newPlace?.courseId, to.id); assert.equal(newPlace?.readyToMoveAt, null);
  assert.equal((await read({ q: f.id })).total, 0);
  state.clubId = "club_bishopstown";
  assert.equal((await read({ q: f.id })).total, 0);
});

test("ending a place removes it from the queue, while audit failures roll back the entire handoff", async () => {
  const f = await swimmer(); state.failedAction = "ready-to-move";
  await assert.rejects(actions.confirmLevelCompletion(f.input), /audit failure/);
  assert.equal(await fixture.prisma.levelCompletion.count({ where: { studentId: f.id } }), 0);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entityId: f.id } }), 0);
  assert.equal((await read({ q: f.id })).total, 0);
  state.failedAction = ""; await actions.confirmLevelCompletion(f.input);
  state.auditFails = true;
  await assert.rejects(actions.cancelInstructorMoveReadiness(f.input), /audit failure/);
  assert.equal((await read({ q: f.id })).total, 1);
  state.auditFails = false;
  assert.equal((await enrolments.endEnrolment(f.place.id, { status: "WITHDRAWN", note: "Synthetic withdrawal" })).ok, true);
  assert.equal((await read({ q: f.id })).total, 0);
});

test("a full destination cannot consume a queued handoff", async () => {
  const f = await swimmer(); await actions.confirmLevelCompletion(f.input);
  const to = await fixture.prisma.course.create({ data: { clubId: state.clubId, levelId: "move-next", dayOfWeek: "MONDAY", startMinutes: 960, durationMinutes: 30, capacity: 0 } });
  rejected(await enrolments.transferEnrolment(f.place.id, to.id, "", { choice: "move", ids: [f.place.id, to.id] }), /full/);
  assert.equal((await read({ q: f.id })).total, 1);
  assert.equal((await fixture.prisma.enrolment.findUnique({ where: { id: f.place.id } }))?.status, "ACTIVE");
});

test("queue search, pagination and authentication do not expose unrelated swimmers", async () => {
  const f = await swimmer(); await actions.confirmLevelCompletion(f.input);
  const row = (await read({ q: f.id, page: 999 })).items[0];
  assert.equal(row.id, f.place.id);
  assert.equal((await read({ q: `TEST-${serial}` })).items[0].id, f.place.id);
  assert.equal((await read({ q: "not-a-swimmer" })).total, 0);
  assert.equal((await read({ q: f.id, page: -1 })).page, 1);
  state.authenticated = false;
  await assert.rejects(read(), /sign in required/);
});
