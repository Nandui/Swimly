import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { offlineLabel, offlineTime } from "../features/me/server/offline";

/** Training taken with no signal in Turnfin Me (e-learning
 *  phase 9): the phone's time for a finished lesson or handed-in work is kept
 *  only when it is believable, and the audit says it was done offline. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
let handIn: typeof import("../features/me/server/hand-in");
const ORG = "org_leisureworld";
const state = { id: "maya", permissions: [] as string[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["training"], primaryScreens: ["training"], grants: [], authMethod: "password", authAt: Date.now() } };
}
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: object[]) => ({ type: "doc", content });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "" } });
  const mods = {
    "@/lib/prisma": { prisma: db },
    "@/lib/authz": {
      AuthorizationError: class extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, perm: PermissionKey) => expandPermissions(s.user.permissions).has(perm),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
  builder = serverModule("src/modules/training/features/builder/server/actions.ts", mods);
  courses = Object.assign({}, ...["courses", "assignments"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/actions.ts`, mods)));
  course = serverModule("src/modules/training/features/me/server/course.ts", mods);
  handIn = serverModule("src/modules/training/features/me/server/hand-in.ts", mods);
});
after(async () => { await fixture?.close(); });

test("the phone's time is kept only when it's believable", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const assigned = new Date("2026-10-10T09:00:00Z");
  assert.equal(offlineTime("2026-10-16T10:42:00Z", assigned, now)?.toISOString(), "2026-10-16T10:42:00.000Z");
  assert.equal(offlineTime(null, assigned, now), null, "online: no time sent");
  assert.equal(offlineTime("yesterday", assigned, now), null);
  assert.equal(offlineTime(12345, assigned, now), null);
  assert.equal(offlineTime("2026-10-09T10:00:00Z", assigned, now), null, "before it was assigned");
  assert.equal(offlineTime("2026-09-20T10:00:00Z", new Date("2026-09-01"), now), null, "more than 14 days ago");
  assert.equal(offlineTime("2026-10-16T13:00:00Z", assigned, now), null, "in the future");
  assert.equal(offlineTime("2026-10-16T12:01:00Z", assigned, now)?.toISOString(), now.toISOString(), "a phone clock a little ahead counts as now");
  assert.equal(offlineLabel(new Date("2026-10-16T09:42:00Z")), "16 Oct, 10:42", "Irish time");
});

test("a lesson finished and work handed in with no signal keep when they were done", async () => {
  Object.assign(state, { id: "maya", permissions: ["training.manage", "training.assign"] });
  const made = await courses.saveCourse(null, { title: "Plant room walk-through", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(made.ok);
  const section = await builder.addSection(made.id, "Walk-through");
  assert.ok(section.ok);
  const read = await builder.addLesson(section.id, "READING", "Where things are");
  const work = await builder.addLesson(section.id, "ASSIGNMENT", "Your readings");
  assert.ok(read.ok && work.ok);
  await builder.saveLesson(read.id, { title: "Where things are", body: JSON.stringify(doc(p("The dosing pumps are on the left."))), videoUrl: "", fileId: "", minutes: null });
  await builder.saveLesson(work.id, { title: "Your readings", body: JSON.stringify(doc(p("Write down the readings."))), videoUrl: "", fileId: "", minutes: null,
    data: JSON.stringify({ handIn: { text: "required", photo: "off", review: true } }) });
  assert.equal((await builder.publishCourse(made.id)).ok, true);
  assert.equal((await courses.assignTraining(made.id, ["ava"], "")).ok, true);
  const assignment = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: made.id } });
  const ava = { id: "ava", name: "ava" };
  // Assigned yesterday; done this morning with no signal.
  await fixture.prisma.trainingAssignment.update({ where: { id: assignment.id }, data: { assignedAt: new Date(Date.now() - 86_400_000) } });

  const at = new Date(Date.now() - 3 * 3_600_000);
  assert.equal((await course.completeLessonFor(ava, assignment.id, read.id, at.toISOString())).ok, true);
  const progress = await fixture.prisma.trainingLessonProgress.findFirstOrThrow({ where: { assignmentId: assignment.id, lessonId: read.id } });
  assert.equal(progress.completedAt.toISOString(), at.toISOString());
  assert.equal((await course.completeLessonFor(ava, assignment.id, read.id, at.toISOString())).ok, true, "sent twice is fine");

  assert.equal((await handIn.handInWork(ava, assignment.id, work.id, { text: "pH 7.4", file: null, keepFile: false, at: "2030-01-01T00:00:00Z" })).ok, true);
  const submission = await fixture.prisma.trainingSubmission.findFirstOrThrow({ where: { assignmentId: assignment.id } });
  assert.ok(Math.abs(submission.submittedAt.getTime() - Date.now()) < 60_000, "a time in the future is ignored");

  const audit = await fixture.prisma.auditLog.findMany({ where: { entityId: assignment.id }, select: { summary: true } });
  assert.ok(audit.some((r) => r.summary.includes(`offline at ${offlineLabel(at)}`)), "the audit says it was done offline, and when");
  assert.ok(!audit.some((r) => r.summary.includes("Handed in") && r.summary.includes("offline")), "not when the time wasn't believable");
});
