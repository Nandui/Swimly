import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { cleanAnswer, isCorrect, learnerQuestion, markPaper, matchPartners, normaliseQuestion, questionProblem, rightAnswer, seeded, type Question } from "../shared/questions";

/** Quizzes and final exams (e-learning phase 2) against a
 *  real in-memory Postgres: authors write questions per section, learners
 *  practise on Quiz lessons and sit a marked exam that never sends the key,
 *  attempts run out, trainers give another, and a pass finishes the course. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
let own: typeof import("../features/me/server/self");
let exam: typeof import("../features/me/server/exam");
const ORG = "org_leisureworld";
const state = { id: "maya", permissions: [] as string[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["training"], primaryScreens: ["training"], grants: [], authMethod: "password", authAt: Date.now() } };
}
function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "@/lib/authz": {
      AuthorizationError: class extends Error {},
      requireSession: async () => session(),
      can: (s: { user: { permissions: string[] } }, p: PermissionKey) => expandPermissions(s.user.permissions).has(p),
      canSee: () => true,
    },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "next/cache": { revalidatePath() {} },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const as = (id: string, permissions: string[] = []) => Object.assign(state, { id, permissions });
const doc = (text: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const me = (id: string) => ({ id, name: id });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava", "riley", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "" } });
  builder = serverModule("src/modules/training/features/builder/server/actions.ts", doubles());
  courses = Object.assign({}, ...["courses", "assignments"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/actions.ts`, doubles())));
  course = serverModule("src/modules/training/features/me/server/course.ts", doubles());
  own = serverModule("src/modules/training/features/me/server/self.ts", doubles());
  exam = serverModule("src/modules/training/features/me/server/exam.ts", doubles());
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

const q = (kind: Question["kind"], options: Partial<Question["options"][number]>[], extra: Partial<Question> = {}) =>
  normaliseQuestion({ id: "q", sectionId: "s", kind, prompt: "What is right?", options, explanation: "Because.", ...extra }, (() => { let n = 0; return () => `o${++n}`; })())!;

test("each kind of question says what it still needs", () => {
  assert.match(questionProblem(q("SINGLE", [{ text: "A" }, { text: "B" }]))!, /right/i);
  assert.equal(questionProblem(q("SINGLE", [{ text: "A", correct: true }, { text: "B" }])), null);
  assert.ok(questionProblem(q("SINGLE", [{ text: "A", correct: true }, { text: "B", correct: true }])), "one right answer only");
  assert.equal(questionProblem(q("MULTIPLE", [{ text: "A", correct: true }, { text: "B", correct: true }, { text: "C" }])), null);
  assert.equal(questionProblem(q("TRUE_FALSE", [{ id: "true", correct: true }])), null);
  assert.ok(questionProblem(q("ORDER", [{ text: "Only one" }])));
  assert.ok(questionProblem(q("MATCH", [{ text: "A", match: "1" }, { text: "B", match: "1" }])), "partners must differ");
  assert.ok(questionProblem(q("SINGLE", [{ text: "A", correct: true }, { text: "B" }], { prompt: "?" })));
});

test("marking is all or nothing, and only accepts this question's own options", () => {
  const single = q("SINGLE", [{ text: "A", correct: true }, { text: "B" }]);
  assert.equal(isCorrect(single, cleanAnswer(single, "o1")), true);
  assert.equal(isCorrect(single, cleanAnswer(single, "o2")), false);
  assert.equal(cleanAnswer(single, "someone-elses"), null);
  const multiple = q("MULTIPLE", [{ text: "A", correct: true }, { text: "B", correct: true }, { text: "C" }]);
  assert.equal(isCorrect(multiple, cleanAnswer(multiple, ["o2", "o1"])), true);
  assert.equal(isCorrect(multiple, cleanAnswer(multiple, ["o1"])), false, "half right is wrong");
  assert.equal(isCorrect(multiple, cleanAnswer(multiple, ["o1", "o2", "o3"])), false);
  const order = q("ORDER", [{ text: "Stop" }, { text: "Look" }, { text: "Listen" }]);
  assert.equal(isCorrect(order, cleanAnswer(order, ["o1", "o2", "o3"])), true);
  assert.equal(isCorrect(order, cleanAnswer(order, ["o2", "o1", "o3"])), false);
  assert.equal(cleanAnswer(order, ["o1", "o2"]), null, "every step must be placed");
  const match = q("MATCH", [{ text: "Red", match: "Stop" }, { text: "Green", match: "Go" }]);
  assert.deepEqual(rightAnswer(match), { o1: "p0", o2: "p1" });
  assert.equal(isCorrect(match, cleanAnswer(match, { o1: "p0", o2: "p1" })), true);
  assert.equal(isCorrect(match, cleanAnswer(match, { o1: "p1", o2: "p0" })), false);
  assert.equal(cleanAnswer(match, { o1: "o1" }), null, "partners are not option ids");
  const mark = markPaper({ passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false }, [single, { ...multiple, id: "q2" }], ["q", "q2"], { q: "o1", q2: ["o1"] });
  assert.deepEqual([mark.correct, mark.total, mark.percent, mark.passed], [1, 2, 50, false]);
});

test("what a learner is sent never says which answer is right", () => {
  const match = q("MATCH", [{ text: "Red", match: "Stop" }, { text: "Green", match: "Go" }, { text: "Amber", match: "Wait" }]);
  const seen = learnerQuestion(match, seeded("x"));
  assert.ok(!JSON.stringify(seen).includes("correct"));
  assert.ok(seen.partners?.every((p) => !seen.options.some((o) => o.id === p.id)), "partner ids are not the option ids");
  assert.deepEqual(new Set(seen.partners?.map((p) => p.text)), new Set(matchPartners(match).map((p) => p.text)));
  const order = q("ORDER", [{ text: "1" }, { text: "2" }]);
  for (const seed of ["a", "b", "c", "d"]) assert.notDeepEqual(learnerQuestion(order, seeded(seed)).options.map((o) => o.id), ["o1", "o2"], "never already in order");
});

// ---------------------------------------------------------------------------
// Building and sitting an exam
// ---------------------------------------------------------------------------

let courseId = "", quizLesson = "", lessonIds: string[] = [];
const single = (prompt: string, right: string, wrong: string) => ({ kind: "SINGLE" as const, prompt, imageId: null, explanation: `Because ${right}.`,
  options: [{ text: right, imageId: null, correct: true, match: "" }, { text: wrong, imageId: null, correct: false, match: "" }] });

test("an author adds questions to sections, a quiz lesson and a final exam, then publishes", async () => {
  as("maya", ["training.manage", "training.assign"]);
  const created = await courses.saveCourse(null, { title: "Water testing", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(created.ok);
  courseId = created.id;
  const s1 = await builder.addSection(courseId, "Chlorine");
  const s2 = await builder.addSection(courseId, "pH");
  assert.ok(s1.ok && s2.ok);
  const read = await builder.addLesson(s1.id, "READING", "Free chlorine");
  const quiz = await builder.addLesson(s1.id, "QUIZ", "Check yourself");
  const ph = await builder.addLesson(s2.id, "READING", "Balancing pH");
  assert.ok(read.ok && quiz.ok && ph.ok);
  quizLesson = quiz.id;
  lessonIds = [read.id, quiz.id, ph.id];
  await builder.saveLesson(read.id, { title: "Free chlorine", body: JSON.stringify(doc("Keep it between 1 and 3.")), videoUrl: "", fileId: "", minutes: null });
  await builder.saveLesson(ph.id, { title: "Balancing pH", body: JSON.stringify(doc("Aim for 7.2 to 7.6.")), videoUrl: "", fileId: "", minutes: null });
  const noQuestions = await builder.publishCourse(courseId);
  assert.equal(noQuestions.ok, false, "a quiz needs questions in its section");
  as("riley", ["training.records.read"]);
  assert.equal((await builder.addQuestion(s1.id, single("Safe free chlorine?", "1 to 3", "10"))).ok, false, "only authors");
  as("maya", ["training.manage"]);
  assert.equal((await builder.addQuestion(s1.id, { ...single("Safe free chlorine?", "1 to 3", "10"), options: [] })).ok, false, "a question needs its options");
  for (const [s, p, r, w] of [[s1.id, "Safe free chlorine?", "1 to 3", "10"], [s1.id, "Test how often?", "Every 2 hours", "Weekly"], [s2.id, "Ideal pH?", "7.2 to 7.6", "9"], [s2.id, "Low pH means?", "Acidic", "Alkaline"]]) {
    const added = await builder.addQuestion(s, single(p, r, w));
    assert.equal(added.ok, true, added.ok ? "-" : added.error);
  }
  assert.equal((await builder.saveExam(courseId, { passMark: 75, attempts: 1, draw: null, timeLimit: null, testOut: false })).ok, true);
  const published = await builder.publishCourse(courseId);
  assert.equal(published.ok, true, published.ok ? "-" : published.error);
  const version = await fixture.prisma.trainingCourseVersion.findFirstOrThrow({ where: { courseId } });
  const outline = version.outline as { questions: unknown[]; exam: { passMark: number } };
  assert.equal(outline.questions.length, 4);
  assert.equal(outline.exam.passMark, 75);
});

let assignmentId = "";
test("a quiz checks each answer on the server and only explains a right answer or a given-up one", async () => {
  as("maya", ["training.assign"]);
  assert.equal((await courses.assignTraining(courseId, ["ava"], "")).ok, true);
  assignmentId = (await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId } })).id;
  const lesson = await course.myLesson("ava", assignmentId, quizLesson);
  assert.equal(lesson?.questions?.length, 2, "only this section's questions");
  assert.ok(!JSON.stringify(lesson).includes("\"correct\""), "no key in the lesson");
  const first = lesson!.questions![0];
  const bank = await fixture.prisma.trainingQuestion.findUniqueOrThrow({ where: { id: first.id } });
  const right = (bank.options as { id: string; correct: boolean }[]).find((o) => o.correct)!.id;
  const wrong = (bank.options as { id: string; correct: boolean }[]).find((o) => !o.correct)!.id;
  assert.deepEqual(await exam.checkQuizAnswer("ava", assignmentId, quizLesson, first.id, wrong, false), { correct: false, explanation: "" });
  assert.equal((await exam.checkQuizAnswer("ava", assignmentId, quizLesson, first.id, wrong, true))?.explanation.startsWith("Because"), true);
  assert.equal((await exam.checkQuizAnswer("ava", assignmentId, quizLesson, first.id, right, false))?.correct, true);
  assert.equal(await exam.checkQuizAnswer("noah", assignmentId, quizLesson, first.id, right, false), null, "not someone else's");
});

const answerAll = async (who: string, attemptId: string, rightCount: number) => {
  const paper = (await exam.myExamPaper(me(who), assignmentId))!;
  let n = 0;
  for (const question of paper.questions) {
    const bank = await fixture.prisma.trainingQuestion.findUniqueOrThrow({ where: { id: question.id } });
    const options = bank.options as { id: string; correct: boolean }[];
    const pick = n++ < rightCount ? options.find((o) => o.correct)! : options.find((o) => !o.correct)!;
    assert.equal((await exam.saveExamAnswer(me(who), assignmentId, attemptId, question.id, pick.id)).ok, true);
  }
};

test("the exam waits for the lessons, marks on the server, and runs out of attempts", async () => {
  const before = await exam.myExam(me("ava"), assignmentId);
  assert.deepEqual([before?.questions, before?.passMark, before?.canStart, before?.reason], [4, 75, false, "Finish the lessons first."]);
  assert.equal((await exam.startExam(me("ava"), assignmentId)).ok, false);
  for (const id of lessonIds) assert.equal((await course.completeLessonFor(me("ava"), assignmentId, id)).ok, true);
  assert.equal((await own.completeTrainingFor(me("ava"), assignmentId, "")).ok, false, "the exam still has to be passed");
  const started = await exam.startExam(me("ava"), assignmentId);
  assert.ok(started.ok && "paper" in started);
  const paper = started.paper;
  assert.equal(paper.questions.length, 4);
  assert.ok(!JSON.stringify(paper).includes("\"correct\""), "no key on the paper");
  const again = await exam.startExam(me("ava"), assignmentId);
  assert.equal(again.ok && "paper" in again ? again.paper.id : "", paper.id, "starting again returns the open paper");
  assert.equal((await exam.saveExamAnswer(me("noah"), assignmentId, paper.id, paper.questions[0].id, "x")).ok, false, "not someone else's");
  assert.equal((await exam.saveExamAnswer(me("ava"), assignmentId, paper.id, paper.questions[0].id, "not-an-option")).ok, false);
  await answerAll("ava", paper.id, 2);
  assert.equal((await exam.submitExam(me("ava"), assignmentId, paper.id)).ok, true);
  assert.equal((await exam.saveExamAnswer(me("ava"), assignmentId, paper.id, paper.questions[0].id, null)).ok, false, "handed in is final");
  const failed = await exam.myExamResult("ava", assignmentId, 1);
  assert.deepEqual([failed?.correct, failed?.percent, failed?.passed, failed?.review], [2, 50, false, null], "a fail shows no answers");
  assert.ok((failed?.revisit.length ?? 0) > 0, "and points back to the sections");
  const after = await exam.myExam(me("ava"), assignmentId);
  assert.deepEqual([after?.attempts.left, after?.canStart], [0, false]);
  assert.match(after?.reason ?? "", /trainer can give you another/);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "TrainingAssignment", entityId: assignmentId, summary: { contains: "final exam" } } }), 2);
});

test("a trainer gives another attempt, and a pass finishes the course", async () => {
  as("riley", ["training.records.read"]);
  await assert.rejects(courses.giveExamAttempt(assignmentId), "reading records is not assigning");
  as("maya", ["training.assign"]);
  assert.equal((await courses.giveExamAttempt(assignmentId)).ok, true);
  const started = await exam.startExam(me("ava"), assignmentId);
  assert.ok(started.ok && "paper" in started);
  await answerAll("ava", started.paper.id, 3);
  assert.equal((await exam.submitExam(me("ava"), assignmentId, started.paper.id)).ok, true);
  const passed = await exam.myExamResult("ava", assignmentId, 2);
  assert.deepEqual([passed?.percent, passed?.passed, passed?.review?.length], [75, true, 4], "a pass shows the full review");
  assert.ok(passed?.review?.every((r) => r.right && r.explanation));
  const row = await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
  assert.equal(row.status, "COMPLETED");
});

test("a timed exam is handed in by itself once the time and grace have gone", async () => {
  as("maya", ["training.manage", "training.assign"]);
  assert.equal((await builder.saveExam(courseId, { passMark: 75, attempts: 2, draw: 2, timeLimit: 10, testOut: true })).ok, true);
  assert.equal((await builder.publishCourse(courseId)).ok, true);
  assert.equal((await courses.assignTraining(courseId, ["noah"], "")).ok, true);
  assignmentId = (await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "noah", courseId } })).id;
  const summary = await exam.myExam(me("noah"), assignmentId);
  assert.deepEqual([summary?.questions, summary?.canStart, summary?.testOut], [2, true, true], "test-out: no lessons needed first");
  const started = await exam.startExam(me("noah"), assignmentId);
  assert.ok(started.ok && "paper" in started);
  assert.equal(started.paper.questions.length, 2, "two drawn from the bank");
  await fixture.prisma.trainingExamAttempt.update({ where: { id: started.paper.id }, data: { deadlineAt: new Date(Date.now() - 60_000) } });
  assert.equal((await exam.saveExamAnswer(me("noah"), assignmentId, started.paper.id, started.paper.questions[0].id, null)).ok, false, "too late");
  const closed = await exam.myExam(me("noah"), assignmentId);
  assert.deepEqual([closed?.open, closed?.history.length, closed?.history[0]?.correct], [null, 1, 0]);
});
