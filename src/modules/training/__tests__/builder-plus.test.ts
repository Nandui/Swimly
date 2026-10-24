import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { parseQuestions, readRows } from "../shared/import";
import { cleanLessonData, docChecks, frozenOutline, learnerScenario, publishProblems, readOutline, scenarioProblems, startingLessonData, TEMPLATE_MARK, type ScenarioStep } from "../shared/lessons";
import { blankedPrompt, cleanAnswer, isCorrect, learnerQuestion, normaliseQuestion, questionProblem, readBlanks, rightAnswer, sameAnswer, seeded, spotAnswer, type Question } from "../shared/questions";
import { COURSE_TEMPLATES, templateByKey } from "../shared/templates";

/** The richer builder and lessons (e-learning phase 3):
 *  fill-in-the-blanks and pick-the-spot questions, scenarios, flashcards and
 *  checklists, templates, copies, pasted questions, review comments, and
 *  asking people to take a changed course again. Against a real in-memory
 *  Postgres where it writes. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let library: typeof import("../features/builder/server/library");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
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
const p = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: object[]) => ({ type: "doc", content });
const ids = () => { let n = 0; return () => `n${++n}`; };

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava", "riley", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "" } });
  builder = serverModule("src/modules/training/features/builder/server/actions.ts", doubles());
  library = serverModule("src/modules/training/features/builder/server/library.ts", doubles());
  courses = Object.assign({}, ...["courses", "assignments"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/actions.ts`, doubles())));
  course = serverModule("src/modules/training/features/me/server/course.ts", doubles());
  exam = serverModule("src/modules/training/features/me/server/exam.ts", doubles());
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

const q = (kind: Question["kind"], prompt: string, options: Partial<Question["options"][number]>[] = [], extra: Partial<Question> = {}) =>
  normaliseQuestion({ id: "q", sectionId: "s", kind, prompt, options, explanation: "Because.", ...extra }, ids())!;

test("fill in the blanks reads its answers from the sentence and forgives case, spaces and number styles", () => {
  const blanks = q("FILL_BLANK", "Free chlorine stays between [1|1.0] and [3] mg/l, tested every [two hours|2 hours].");
  assert.equal(questionProblem(blanks), null);
  assert.deepEqual(blanks.options.map((o) => o.id), ["b0", "b1", "b2"]);
  assert.equal(blankedPrompt(blanks.prompt), "Free chlorine stays between ____ and ____ mg/l, tested every ____.");
  assert.deepEqual(readBlanks("No blanks here").blanks, []);
  assert.match(questionProblem(q("FILL_BLANK", "No blanks here"))!, /square brackets/);
  assert.ok(sameAnswer(" Two  Hours. ", "two hours") && sameAnswer("1,0", "1") && !sameAnswer("10", "1"));
  assert.equal(isCorrect(blanks, cleanAnswer(blanks, { b0: "1.0", b1: "3", b2: "2 hours" })), true);
  assert.equal(isCorrect(blanks, cleanAnswer(blanks, { b0: "1", b1: "3" })), false, "every blank must be filled");
  assert.equal(isCorrect(blanks, cleanAnswer(blanks, { b0: "1", b1: "4", b2: "two hours" })), false);
  const seen = learnerQuestion(blanks, seeded("x")) as ReturnType<typeof learnerQuestion> & { segments?: string[] };
  assert.equal(seen.segments?.length, 4);
  assert.ok(!JSON.stringify(seen).includes("two hours") && !JSON.stringify(seen).includes("[3]"), "the answers never reach the learner");
});

test("pick the spot needs a picture and an area, and marks a tap inside any right area", () => {
  assert.match(questionProblem(q("HOTSPOT", "Where is the alarm?", [{ area: { x: 10, y: 10, w: 20, h: 20 } }]))!, /picture/);
  const spot = q("HOTSPOT", "Where is the alarm?", [{ area: { x: 10, y: 10, w: 20, h: 20 } }, { area: { x: 120, y: -5, w: 1, h: 1 } }], { imageId: "img1" });
  assert.equal(questionProblem(spot), null);
  assert.deepEqual(spot.options[1].area, { x: 98, y: 0, w: 2, h: 2 }, "areas are kept inside the picture");
  assert.equal(isCorrect(spot, cleanAnswer(spot, spotAnswer(15, 25))), true);
  assert.equal(isCorrect(spot, cleanAnswer(spot, spotAnswer(50, 50))), false);
  assert.equal(cleanAnswer(spot, "here"), null);
  assert.ok(rightAnswer(spot));
  assert.deepEqual(learnerQuestion(spot, seeded("x")).options, [], "the areas never reach the learner");
});

const scene = (id: string, choices: Partial<ScenarioStep["choices"][number]>[], text = "Something happens.") =>
  ({ id, text, imageId: null, choices: choices.map((c, i) => ({ id: `${id}c${i}`, text: "Do this", feedback: "", next: null, best: false, ...c })) });

test("a scenario must be playable: every scene reachable and a best ending", () => {
  const good = [scene("a", [{ next: "b" }, { best: false }]), scene("b", [{ best: true }])];
  assert.deepEqual(scenarioProblems("Pool alarm", good), []);
  assert.match(scenarioProblems("Pool alarm", [scene("a", [{}])]).join(" "), /best outcome/);
  assert.match(scenarioProblems("Pool alarm", [scene("a", [{ best: true }]), scene("b", [{ best: true }])]).join(" "), /Nothing leads to scene 2/);
  const cleaned = cleanLessonData("SCENARIO", { steps: [scene("a", [{ next: "a", best: true }, { next: "missing" }, { next: "b", best: true }]), scene("b", [{ best: true }])] }, ids());
  assert.deepEqual(cleaned?.steps?.[0].choices.map((c) => [c.next, c.best]), [[null, true], [null, false], ["b", false]], "a choice leads only to another scene, and only an ending can be best");
  const played = learnerScenario(good);
  assert.equal(played.length, 2);
});

test("a draft keeps empty rows; a published version drops them", () => {
  const start = startingLessonData("FLASHCARDS", ids());
  assert.equal(start?.cards?.length, 3);
  assert.equal(cleanLessonData("FLASHCARDS", start, ids(), true)?.cards?.length, 3);
  assert.equal(cleanLessonData("FLASHCARDS", start, ids())?.cards?.length, 0);
  assert.equal(cleanLessonData("CHECKLIST", { items: [{ id: "i1", text: "Rescue tube" }, { id: "i1", text: "Spinal board" }] }, ids())?.items?.map((i) => i.id).join(), "i1,n1", "ids stay unique");
  assert.equal(cleanLessonData("READING", { steps: [] }), null);
});

test("knowledge checks are found anywhere in a lesson's text", () => {
  const body = doc(p("Read this."), { type: "callout", attrs: { tone: "tip" }, content: [{ type: "knowledgeCheck", attrs: { questionId: "q1" } }] }, { type: "knowledgeCheck", attrs: { questionId: "q2" } });
  assert.deepEqual(docChecks(body as never), ["q1", "q2"]);
});

test("every template is ready to fill in, and can't be published until it is", () => {
  assert.ok(COURSE_TEMPLATES.length >= 5);
  assert.equal(templateByKey("nope"), null);
  for (const t of COURSE_TEMPLATES) {
    assert.ok(t.sections.length && t.sections.every((s) => s.lessons.length), t.key);
    const outline = readOutline({ sections: t.sections.map((s, si) => ({ id: `s${si}`, title: s.title, lessons: s.lessons.map((l, li) => ({
      id: `l${si}-${li}`, kind: l.kind, title: l.title, body: l.body ?? null, videoUrl: "", fileId: null, minutes: l.minutes ?? null, data: l.data ?? null,
    })) })), questions: [], exam: null });
    assert.ok(publishProblems(outline).some((m) => m.includes(TEMPLATE_MARK)), `${t.key} keeps its placeholders`);
  }
});

test("questions pasted from a spreadsheet are read row by row, with what's wrong with the rest", () => {
  assert.deepEqual(readRows('Type,Question\n"One","Say ""hi"", then go"\n'), [["Type", "Question"], ["One", 'Say "hi", then go']]);
  const pasted = [
    ["Type", "Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Option F", "Right answer", "Why"],
    ["One", "Safe free chlorine?", "1 to 3 mg/l", "10 mg/l", "", "", "", "", "A", "That's the range."],
    ["Several", "Which are rescue aids?", "Tube", "Pole", "Phone", "", "", "", "A, B", ""],
    ["True/false", "Run on the deck.", "", "", "", "", "", "", "False", ""],
    ["Order", "Put in order", "Shout", "Reach", "Throw", "", "", "", "", ""],
    ["Match", "Match flags", "Red = Danger", "Yellow = Caution", "", "", "", "", "", ""],
    ["Blanks", "The pool is [1.8] metres deep.", "", "", "", "", "", "", "", ""],
    ["Guess", "What?", "", "", "", "", "", "", "", ""],
    ["One", "No right answer given", "A", "B", "", "", "", "", "", ""],
  ].map((r) => r.join("\t")).join("\n");
  const { questions, problems } = parseQuestions(pasted, ids());
  assert.deepEqual(questions.map((x) => x.kind), ["SINGLE", "MULTIPLE", "TRUE_FALSE", "ORDER", "MATCH", "FILL_BLANK"]);
  assert.deepEqual(questions[1].options.map((o) => o.correct), [true, true, false]);
  assert.equal(questions[2].options.find((o) => o.correct)?.id, "false");
  assert.deepEqual(questions[4].options.map((o) => o.match), ["Danger", "Caution"]);
  assert.deepEqual(problems.map((x) => x.row), [7, 8]);
});

// ---------------------------------------------------------------------------
// The builder's library
// ---------------------------------------------------------------------------

let sourceId = "", sourceSection = "", readingId = "", questionId = "";

test("a template becomes a draft that can't be published until its placeholders are replaced", async () => {
  as("riley", ["training.records.read"]);
  assert.equal((await library.createFromTemplate("policy", "Lone working")).ok, false, "only authors");
  as("maya", ["training.manage"]);
  assert.equal((await library.createFromTemplate("nope", "Lone working")).ok, false);
  const made = await library.createFromTemplate("policy", "Lone working");
  assert.ok(made.ok);
  const lessons = await fixture.prisma.trainingLesson.count({ where: { section: { courseId: made.id } } });
  assert.ok(lessons >= 3);
  const published = await builder.publishCourse(made.id);
  assert.equal(published.ok, false);
  assert.match(published.ok ? "" : published.error, new RegExp(TEMPLATE_MARK));
});

test("an author builds scenario, flashcards and a knowledge check, and the learner gets them without the key", async () => {
  as("maya", ["training.manage", "training.assign"]);
  const created = await courses.saveCourse(null, { title: "Poolside emergencies", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(created.ok);
  sourceId = created.id;
  const section = await builder.addSection(sourceId, "The alarm");
  assert.ok(section.ok);
  sourceSection = section.id;
  const added = await builder.addQuestion(sourceSection, { kind: "SINGLE", prompt: "Who presses the alarm?", imageId: null, explanation: "Whoever sees it first.",
    options: [{ text: "Whoever sees it", imageId: null, correct: true, match: "", area: null }, { text: "The manager", imageId: null, correct: false, match: "", area: null }] });
  assert.ok(added.ok);
  questionId = added.id;
  const reading = await builder.addLesson(sourceSection, "READING", "Raising the alarm");
  const scenario = await builder.addLesson(sourceSection, "SCENARIO", "Someone in difficulty");
  const cards = await builder.addLesson(sourceSection, "FLASHCARDS", "Signals");
  assert.ok(reading.ok && scenario.ok && cards.ok);
  readingId = reading.id;
  const started = await fixture.prisma.trainingLesson.findUniqueOrThrow({ where: { id: scenario.id } });
  assert.equal((started.data as { steps: unknown[] }).steps.length, 1, "a new scenario starts with a scene to fill in");
  const save = (id: string, title: string, extra: object) => builder.saveLesson(id, { title, body: null, videoUrl: "", fileId: "", minutes: null, ...extra });
  assert.equal((await save(reading.id, "Raising the alarm", { body: JSON.stringify(doc(p("Press it."), { type: "knowledgeCheck", attrs: { questionId } })) })).ok, true);
  assert.equal((await save(scenario.id, "Someone in difficulty", { data: JSON.stringify({ steps: [scene("a", [{ next: "b", feedback: "Good start." }, { text: "Walk away", feedback: "Never." }], "A swimmer waves."), scene("b", [{ best: true, feedback: "Right." }], "You reach them.")] }) })).ok, true);
  assert.equal((await save(cards.id, "Signals", { data: JSON.stringify({ cards: [{ id: "c1", front: "One long blast", back: "Clear the pool", imageId: null }, { id: "c2", front: "Two short blasts", back: "Lifeguard needs help", imageId: null }, { id: "c3", front: "", back: "", imageId: null }] }) })).ok, true);
  const draft = await fixture.prisma.trainingLesson.findUniqueOrThrow({ where: { id: cards.id } });
  assert.equal((draft.data as { cards: unknown[] }).cards.length, 3, "the draft keeps the empty card");
  const published = await builder.publishCourse(sourceId, { changeNote: "First version" });
  assert.equal(published.ok, true, published.ok ? "-" : published.error);
  const version = await fixture.prisma.trainingCourseVersion.findFirstOrThrow({ where: { courseId: sourceId } });
  assert.equal(version.changeNote, "First version");
  assert.equal(frozenOutline({ sections: [], questions: [], exam: null }).sections.length, 0);
  assert.equal(readOutline(version.outline).sections[0].lessons[2].data?.cards?.length, 2, "the version drops it");

  assert.equal((await courses.assignTraining(sourceId, ["ava"], "")).ok, true);
  const assignment = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: sourceId } });
  const lesson = await course.myLesson("ava", assignment.id, reading.id);
  assert.equal(lesson?.checks.length, 1);
  assert.ok(!JSON.stringify(lesson).includes("\"correct\""), "no key with the knowledge check");
  const right = (await fixture.prisma.trainingQuestion.findUniqueOrThrow({ where: { id: questionId } })).options as { id: string; correct: boolean }[];
  assert.equal((await exam.checkQuizAnswer("ava", assignment.id, reading.id, questionId, right.find((o) => o.correct)!.id, false))?.correct, true, "a knowledge check is checked on the server");
  const played = await course.myLesson("ava", assignment.id, scenario.id);
  assert.equal(played?.steps?.length, 2);
});

test("a course is duplicated whole, and lessons copied into another bring their knowledge-check questions", async () => {
  as("maya", ["training.manage"]);
  const copy = await library.duplicateCourse(sourceId, "Poolside emergencies (Bishopstown)");
  assert.ok(copy.ok);
  assert.equal((await library.duplicateCourse(sourceId, "Poolside emergencies (Bishopstown)")).ok, false, "names stay unique");
  const copied = await fixture.prisma.trainingCourse.findUniqueOrThrow({ where: { id: copy.id }, select: { publishedVersionId: true, assignments: { select: { id: true } },
    sections: { select: { lessons: { select: { kind: true, body: true } }, questions: { select: { id: true } } } } } });
  assert.deepEqual([copied.publishedVersionId, copied.assignments.length], [null, 0], "unpublished, nobody assigned");
  assert.deepEqual(copied.sections[0].lessons.map((l) => l.kind).sort(), ["FLASHCARDS", "READING", "SCENARIO"]);
  const check = docChecks(copied.sections[0].lessons.find((l) => l.kind === "READING")!.body as never);
  assert.deepEqual(check, [copied.sections[0].questions[0].id], "the knowledge check points at the copy's own question");

  const other = await courses.saveCourse(null, { title: "Duty manager induction", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(other.ok);
  const section = await builder.addSection(other.id, "Emergencies");
  assert.ok(section.ok);
  assert.equal((await library.copyIntoSection(section.id, sourceId, [], [])).ok, false);
  assert.equal((await library.copyIntoSection(section.id, sourceId, [readingId], [])).ok, true);
  const brought = await fixture.prisma.trainingSection.findUniqueOrThrow({ where: { id: section.id }, select: { lessons: { select: { body: true } }, questions: { select: { id: true } } } });
  assert.equal(brought.questions.length, 1, "the question came too");
  assert.deepEqual(docChecks(brought.lessons[0].body as never), [brought.questions[0].id]);
  assert.ok(await fixture.prisma.auditLog.count({ where: { entityId: other.id, summary: { contains: "Copied 1 lesson and 1 question" } } }));

  const pasted = await library.importQuestions(section.id, "One\tWhere is the alarm?\tBy the door\tIn the office\t\t\t\t\tA\t\nGuess\tWhat?");
  assert.deepEqual(pasted.ok ? [pasted.added, pasted.skipped] : pasted.error, [1, 1]);
});

test("trainers comment on a draft and mark comments done; authors keep them", async () => {
  as("ava");
  await assert.rejects(library.addReviewComment(sourceId, null, "Looks good"), "learners don't comment");
  as("noah", ["training.records.read"]);
  assert.equal((await library.addReviewComment(sourceId, null, "Looks good")).ok, false, "reading records is not reviewing");
  as("riley", ["training.signoff"]);
  assert.equal((await library.addReviewComment(sourceId, readingId, "Say where the alarm is.")).ok, true);
  assert.equal((await library.addReviewComment(sourceId, "not-a-lesson", "Hmm")).ok, false);
  const comment = await fixture.prisma.trainingReviewComment.findFirstOrThrow({ where: { courseId: sourceId } });
  as("maya", ["training.manage"]);
  assert.equal((await library.resolveReviewComment(comment.id)).ok, true);
  const done = await fixture.prisma.trainingReviewComment.findUniqueOrThrow({ where: { id: comment.id } });
  assert.equal(done.resolvedByName, "maya");
});

test("publishing a change can ask everyone who finished to take it again", async () => {
  as("maya", ["training.manage"]);
  await fixture.prisma.trainingAssignment.updateMany({ where: { courseId: sourceId, userId: "ava" }, data: { status: "COMPLETED", completedAt: new Date() } });
  assert.equal((await builder.saveLesson(readingId, { title: "Raising the alarm", body: JSON.stringify(doc(p("Press it and shout."))), videoUrl: "", fileId: "", minutes: null })).ok, true);
  const noRight = await builder.publishCourse(sourceId, { changeNote: "Shout too", retake: true });
  assert.equal(noRight.ok, false, "a retake assigns, so it needs Manage");
  as("maya", ["training.manage", "training.assign"]);
  const published = await builder.publishCourse(sourceId, { changeNote: "Shout as well as pressing the alarm.", retake: true, dueOn: "2099-01-31" });
  assert.deepEqual(published.ok ? published.retakes : published.error, 1);
  const again = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { courseId: sourceId, userId: "ava", status: "ASSIGNED" }, select: { id: true, versionId: true } });
  const version = await fixture.prisma.trainingCourseVersion.findUniqueOrThrow({ where: { id: again.versionId! }, select: { number: true, retake: true } });
  assert.deepEqual(version, { number: 2, retake: true });
  const detail = await course.myCourse("ava", again.id);
  assert.deepEqual(detail?.whatsNew, { number: 2, note: "Shout as well as pressing the alarm." });
  assert.ok(await fixture.prisma.auditLog.count({ where: { entityId: again.id, summary: { contains: "to take again" } } }));
  const twice = await builder.publishCourse(sourceId, { retake: true });
  assert.deepEqual(twice.ok ? twice.retakes : twice.error, 0, "nobody is given it twice");
});
