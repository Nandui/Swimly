import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { dropOff, examStats, funnel, median, stageOf, summaryOf, timing, type LearnerFacts } from "../features/insight/compute";

/** Training insight (docs/training.md, e-learning phase 7): course analytics, reports and audit
 *  packs. Pure sums first, then against a real in-memory Postgres, with the reader covering two
 *  of three people. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let insight: typeof import("../features/insight/server/data");
const ORG = "org_leisureworld";
const DAY = 86_400_000;
const at = (iso: string) => new Date(`${iso}T10:00:00Z`);
let course = "", ava = "", noah = "";

function facts(over: Partial<LearnerFacts>): LearnerFacts {
  return { userId: "u", status: "ASSIGNED", assignedAt: at("2026-10-01"), dueOn: null, completedAt: null, lessons: [], attempts: [], ...over };
}

// ---------------------------------------------------------------------------
// Pure sums
// ---------------------------------------------------------------------------

test("the middle value ignores the odd person who takes months", () => {
  assert.equal(median([]), null);
  assert.equal(median([3]), 3);
  assert.equal(median([1, 2, 100]), 2);
  assert.equal(median([1, 2, 3, 100]), 2.5);
});

test("how far people get, and where the ones part way through stopped", () => {
  const lessons = ["l1", "l2", "l3"];
  const rows = [
    facts({ status: "COMPLETED", completedAt: at("2026-10-05"), lessons: lessons.map((id) => ({ lessonId: id, at: at("2026-10-03") })), attempts: [{ number: 1, percent: 90, passed: true, submittedAt: at("2026-10-04") }] }),
    facts({ lessons: [{ lessonId: "l1", at: at("2026-10-02") }] }),
    facts({ lessons: [{ lessonId: "l1", at: at("2026-10-02") }] }),
    facts({ lessons: [{ lessonId: "l1", at: at("2026-10-02") }, { lessonId: "l2", at: at("2026-10-02") }] }),
    facts({}),
    facts({ status: "CANCELLED", lessons: [{ lessonId: "l1", at: at("2026-10-02") }] }),
    // Tested out: passed the exam without the lessons, so they count as past every lesson.
    facts({ attempts: [{ number: 1, percent: 100, passed: true, submittedAt: at("2026-10-02") }] }),
  ];
  assert.deepEqual(funnel(rows, lessons), { assigned: 6, started: 5, lessonsDone: 2, examPassed: 2, awaitingSignoff: 0, completed: 1 });
  const d = dropOff(rows, lessons);
  assert.deepEqual(d.lessons.map((l) => [l.lessonId, l.reached, l.stoppedHere]), [["l1", 4, 0], ["l2", 2, 2], ["l3", 1, 1]]);
  assert.equal(d.mostStopped, "l2");
  assert.equal(d.notStarted, 1);
  assert.equal(d.inProgress, 3);
});

test("time to finish, on time and the exam's first-time pass rate", () => {
  const rows = [
    facts({ status: "COMPLETED", assignedAt: at("2026-10-01"), dueOn: at("2026-10-10"), completedAt: at("2026-10-05"), lessons: [{ lessonId: "l1", at: at("2026-10-03") }],
      attempts: [{ number: 1, percent: 60, passed: false, submittedAt: at("2026-10-04") }, { number: 2, percent: 85, passed: true, submittedAt: at("2026-10-05") }] }),
    facts({ status: "COMPLETED", assignedAt: at("2026-10-01"), dueOn: at("2026-10-03"), completedAt: at("2026-10-11"), lessons: [{ lessonId: "l1", at: at("2026-10-09") }],
      attempts: [{ number: 1, percent: 95, passed: true, submittedAt: at("2026-10-10") }] }),
    facts({ attempts: [{ number: 1, percent: 40, passed: false, submittedAt: at("2026-10-04") }] }),
  ];
  assert.deepEqual(timing(rows), { daysToFinish: 7, daysLearning: 2, onTime: 50, dated: 2 });
  assert.deepEqual(examStats(rows), { sat: 3, firstTime: 33, passed: 67, medianBest: 85, triesToPass: 1.5 });
  const s = summaryOf(rows.map((r) => ({ ...r, dueOn: r.dueOn ?? at("2026-10-02") })), "2026-10-15");
  assert.equal(s.overdue, 1);
  assert.equal(s.completion, 67);
});

test("where someone is, in words", () => {
  assert.equal(stageOf(facts({}), 3, "2026-10-15"), "Not started");
  assert.equal(stageOf(facts({ lessons: [{ lessonId: "l1", at: at("2026-10-02") }], dueOn: at("2026-10-10") }), 3, "2026-10-15"), "1 of 3 lessons, overdue");
  assert.equal(stageOf(facts({ status: "SUBMITTED" }), 3, "2026-10-15"), "Awaiting sign-off");
});

// ---------------------------------------------------------------------------
// Against the database, as a manager covering Ava and Noah but not Zoe
// ---------------------------------------------------------------------------

const outline = {
  exam: { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false },
  sections: [{ id: "s1", title: "Before you open", lessons: ["Rescue tube", "Spinal board", "Alarm"].map((title, i) => ({ id: `l${i + 1}`, kind: "READING", title, body: null, videoUrl: "", fileId: null, minutes: 5, data: null })) }],
  questions: [],
};

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.organisation.upsert({ where: { id: ORG }, create: { id: ORG, name: "LeisureWorld", slug: "leisureworld-test" }, update: {} });
  await db.club.create({ data: { id: "site-b", name: "Bishopstown", orgId: ORG } });
  await db.club.create({ data: { id: "site-c", name: "Churchfield", orgId: ORG } });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  await db.user.create({ data: { id: "maya", name: "Maya Manager", email: "maya@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: ["site-b"] } });
  await db.user.create({ data: { id: "ava", name: "Ava Synthetic", email: "ava@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: ["site-b"], managerId: "maya" } });
  await db.user.create({ data: { id: "noah", name: "Noah Synthetic", email: "noah@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: ["site-c"] } });
  await db.user.create({ data: { id: "zoe", name: "Zoe Synthetic", email: "zoe@example.invalid", staffRoleId: "r-staff", orgId: ORG, siteIds: ["site-c"] } });
  course = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic pool opening" } })).id;
  const version = (await db.trainingCourseVersion.create({ data: { courseId: course, number: 1, outline, lessonCount: 3, publishedByName: "maya" } })).id;
  await db.trainingCourse.update({ where: { id: course }, data: { publishedVersionId: version } });
  const now = Date.now();
  ava = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course, userId: "ava", assignedByName: "maya", versionId: version, status: "COMPLETED",
    assignedAt: new Date(now - 10 * DAY), completedAt: new Date(now - 6 * DAY), certificateCode: "SYN-123" } })).id;
  for (const id of ["l1", "l2", "l3"]) await db.trainingLessonProgress.create({ data: { assignmentId: ava, lessonId: id, completedAt: new Date(now - 8 * DAY) } });
  await db.trainingExamAttempt.create({ data: { assignmentId: ava, versionId: version, number: 1, paper: [], total: 10, correct: 6, percent: 60, passed: false, submittedAt: new Date(now - 7 * DAY) } });
  await db.trainingExamAttempt.create({ data: { assignmentId: ava, versionId: version, number: 2, paper: [], total: 10, correct: 9, percent: 90, passed: true, submittedAt: new Date(now - 6 * DAY) } });
  noah = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course, userId: "noah", assignedByName: "maya", versionId: version,
    assignedAt: new Date(now - 20 * DAY), dueOn: new Date(new Date(now - 5 * DAY).toISOString().slice(0, 10)) } })).id;
  await db.trainingLessonProgress.create({ data: { assignmentId: noah, lessonId: "l1", completedAt: new Date(now - 15 * DAY) } });
  await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course, userId: "zoe", assignedByName: "maya", dueOn: new Date("2020-01-01") } });
  await db.auditLog.create({ data: { actorName: "Maya Manager", action: "assign", entity: "TrainingAssignment", entityId: ava, summary: "Gave Ava Synthetic Synthetic pool opening" } });

  const covered = new Set(["ava", "noah"]);
  insight = serverModule("src/modules/training/features/insight/server/data.ts", {
    "@/lib/prisma": { prisma: db },
    "@/lib/clubs/current": { currentClubId: async () => "site-b", currentClubIdIfAny: async () => null },
    "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => { throw new Error("no session"); } },
    "@/lib/policy/session": {
      subjectsFor: async () => ({ kind: "some", userIds: covered }),
      requireCapFor: async (_cap: string, { subjectUserId }: { subjectUserId: string }) => { if (!covered.has(subjectUserId)) throw new Error("not covered"); },
    },
    "@/modules/training/shared/access": { requireTrainingActor: async () => ({ id: "maya", name: "Maya Manager", orgId: ORG, manage: true, assign: true, signoff: true, records: true, qualifications: true }) },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
  });
});
after(async () => { await fixture?.close(); });

test("a course's numbers count only the people the reader covers", async () => {
  const data = (await insight.courseInsight(course))!;
  assert.deepEqual(data.learners.map((l) => l.name), ["Noah Synthetic", "Ava Synthetic"]);
  assert.equal(data.funnel.assigned, 2);
  assert.equal(data.funnel.completed, 1);
  assert.equal(data.overdue, 1);
  assert.equal(data.dropOff.mostStopped, "l2");
  assert.equal(data.dropOff.lessons[1].title, "Spinal board");
  assert.deepEqual([data.exam.firstTime, data.exam.passed, data.exam.triesToPass], [0, 100, 2]);
  assert.equal(data.timing.daysToFinish, 4);
  assert.deepEqual(data.bySite.map((s) => [s.name, s.assigned, s.overdue]), [["Bishopstown", 1, 0], ["Churchfield", 1, 1]]);
  assert.equal(data.minutes, 15);
  const bySite = (await insight.courseInsight(course, { site: "site-b" }))!;
  assert.deepEqual(bySite.learners.map((l) => l.name), ["Ava Synthetic"]);
  const csv = insight.learnerCsv(data);
  assert.equal(csv.length, 3);
  assert.equal(csv[2][csv[0].indexOf("Certificate")], "SYN-123");
});

test("the reports page finds the overdue training by site and by manager", async () => {
  const report = await insight.trainingReport();
  assert.deepEqual(report.overdue.map((o) => [o.name, o.course.title, o.manager]), [["Noah Synthetic", "Synthetic pool opening", null]]);
  assert.deepEqual(report.byManager.map((m) => [m.name, m.overdue]), [["No manager set", 1]]);
  assert.deepEqual(report.bySite.map((s) => [s.name, s.open, s.overdue]), [["Churchfield", 1, 1]]);
  assert.equal(report.totals.overdue, 1);
  assert.equal(report.courses[0].assigned, 2);
  assert.equal(insight.overdueCsv(report)[1][0], "Noah Synthetic");
});

test("an audit pack holds a person's lessons, sittings and trail, and refuses someone not covered", async () => {
  const pack = await insight.personAuditPack("ava");
  assert.equal(pack.courses.length, 1);
  assert.deepEqual(pack.courses[0].lessons.map((l) => l.title), ["Rescue tube", "Spinal board", "Alarm"]);
  assert.deepEqual(pack.courses[0].attempts.map((a) => a.percent), [60, 90]);
  assert.equal(pack.courses[0].version?.number, 1);
  assert.equal(pack.courses[0].certificateCode, "SYN-123");
  assert.equal(pack.trail[0].about, "Synthetic pool opening");
  await assert.rejects(insight.personAuditPack("zoe"), /not found/);
  const coursePack = await insight.courseAuditPack(course);
  assert.deepEqual(coursePack.learners.map((l) => l.name), ["Ava Synthetic", "Noah Synthetic"]);
  assert.equal(coursePack.versions.length, 1);
});
