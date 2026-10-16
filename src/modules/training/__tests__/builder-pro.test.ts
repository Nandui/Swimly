import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { parseQuestions } from "../shared/import";
import { cleanDoc, cleanLessonData, docFiles, docVideos, embedFor, publishProblems, readOutline, startingLessonData, type LessonKind } from "../shared/lessons";
import { cleanAnswer, isCorrect, learnerQuestion, normaliseQuestion, questionProblem, readNumber, rightAnswer, seeded, type Question } from "../shared/questions";
import { qualityTips } from "../shared/quality";

/** The deeper builder (docs/training.md, e-learning phase 8): sorting,
 *  explore-a-picture, hand-in and slides lessons, number and short-answer
 *  questions, tabs, video and file blocks, lessons in order, courses to
 *  finish first, and the quality check. Against a real in-memory Postgres
 *  where it writes. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
let handIn: typeof import("../features/me/server/hand-in");
let review: typeof import("../features/hand-ins/server/actions");
let own: typeof import("../features/me/server/self");
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
const q = (kind: Question["kind"], prompt: string, options: Partial<Question["options"][number]>[] = [], extra: Partial<Question> = {}) =>
  normaliseQuestion({ id: "q", sectionId: "s", kind, prompt, options, explanation: "Because.", ...extra }, ids())!;
const lesson = (id: string, kind: LessonKind, extra: object = {}) => ({ id, kind, title: `Lesson ${id}`, body: null, videoUrl: "", fileId: null, minutes: null, data: null, ...extra });

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["maya", "ava", "riley"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "" } });
  const mods = doubles();
  builder = serverModule("src/modules/training/features/builder/server/actions.ts", mods);
  courses = Object.assign({}, ...["courses", "assignments"].map((f) => serverModule<object>(`src/modules/training/features/${f}/server/actions.ts`, mods)));
  course = serverModule("src/modules/training/features/me/server/course.ts", mods);
  handIn = serverModule("src/modules/training/features/me/server/hand-in.ts", mods);
  review = serverModule("src/modules/training/features/hand-ins/server/actions.ts", mods);
  own = serverModule("src/modules/training/features/me/server/self.ts", mods);
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("a number question is right within its margin, with either decimal mark, and the key never reaches the learner", () => {
  const dose = q("NUMBER", "Free chlorine target?", [{ text: "1,5", match: "0.2", unit: "mg/l" }]);
  assert.equal(questionProblem(dose), null);
  assert.deepEqual(dose.options.map((o) => [o.text, o.match, o.unit]), [["1.5", "0.2", "mg/l"]]);
  assert.equal(readNumber(" 1,7 "), 1.7);
  assert.equal(readNumber("about 2"), null);
  assert.equal(isCorrect(dose, cleanAnswer(dose, "1,7")), true, "the edge of the margin counts");
  assert.equal(isCorrect(dose, cleanAnswer(dose, "1.3")), true);
  assert.equal(isCorrect(dose, cleanAnswer(dose, "1.8")), false);
  assert.equal(cleanAnswer(dose, "lots"), null);
  assert.equal(rightAnswer(dose), "1.5");
  const seen = JSON.stringify(learnerQuestion(dose, seeded("x")));
  assert.ok(!seen.includes("1.5") && !seen.includes("0.2") && seen.includes("mg/l"), "only the unit is sent");
  assert.ok(questionProblem(q("NUMBER", "No answer", [{ text: "", match: "" }])));
});

test("a short answer accepts any of its answers, forgiving case and spacing", () => {
  const word = q("SHORT_ANSWER", "What do you shout before entering?", [{ text: "Clear the pool" }, { text: "Everybody out" }, { text: "" }]);
  assert.equal(questionProblem(word), null);
  assert.equal(word.options.length, 2, "empty answers are dropped");
  assert.equal(isCorrect(word, cleanAnswer(word, "  everybody   OUT ")), true);
  assert.equal(isCorrect(word, cleanAnswer(word, "Help")), false);
  assert.equal(cleanAnswer(word, "   "), null);
  const seen = JSON.stringify(learnerQuestion(word, seeded("x")));
  assert.ok(!seen.includes("Clear the pool") && !seen.includes("Everybody out"));
  assert.ok(questionProblem(q("SHORT_ANSWER", "Nothing accepted", [])));
});

test("number and short-answer questions come in from a spreadsheet", () => {
  const pasted = [
    ["Type", "Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Option F", "Right answer", "Why"],
    ["Number", "Target pH?", "7,4", "0.2", "", "", "", "", "", "The comfortable range."],
    ["Short answer", "Who holds the first aid keys?", "Duty manager", "DM", "", "", "", "", "", ""],
    ["Number", "Not a number", "lots", "", "", "", "", "", "", ""],
  ].map((r) => r.join("\t")).join("\n");
  const { questions, problems } = parseQuestions(pasted, ids());
  assert.deepEqual(questions.map((x) => x.kind), ["NUMBER", "SHORT_ANSWER"]);
  assert.deepEqual(questions[0].options.map((o) => [o.text, o.match]), [["7.4", "0.2"]]);
  assert.deepEqual(questions[1].options.map((o) => o.text), ["Duty manager", "DM"]);
  assert.deepEqual(problems.map((x) => x.row), [3]);
});

test("slides come only from the services that play inside a lesson, as their embed address", () => {
  assert.equal(embedFor("https://docs.google.com/presentation/d/1AbCdEfGhIjK/edit#slide=id.p")?.src, "https://docs.google.com/presentation/d/1AbCdEfGhIjK/embed?start=false&loop=false");
  assert.equal(embedFor("https://docs.google.com/presentation/d/e/2PACX-1vAbCdEf/pub")?.src, "https://docs.google.com/presentation/d/e/2PACX-1vAbCdEf/embed");
  assert.equal(embedFor("https://docs.google.com/forms/d/1FaIpQLSabc/viewform")?.provider, "Google Forms");
  assert.equal(embedFor("https://drive.google.com/file/d/1abcdefGH/view?usp=sharing")?.src, "https://drive.google.com/file/d/1abcdefGH/preview");
  assert.equal(embedFor("https://www.canva.com/design/DAFabcdef/ABCdef123/view")?.src, "https://www.canva.com/design/DAFabcdef/ABCdef123/view?embed");
  assert.equal(embedFor("https://view.genial.ly/64abcdef1234")?.provider, "Genially");
  assert.equal(embedFor("https://leisureworld.h5p.com/content/1291234567/embed")?.provider, "H5P");
  assert.equal(embedFor("https://forms.office.com/r/x?id=DQSIkWdsW0yxEjajBLZtrQ")?.src, "https://forms.office.com/Pages/ResponsePage.aspx?id=DQSIkWdsW0yxEjajBLZtrQ&embed=true");
  for (const bad of ["http://docs.google.com/presentation/d/1AbCdEfGhIjK/edit", "https://example.com/slides", "javascript:alert(1)", "https://docs.google.com/presentation/", "not a link"]) {
    assert.equal(embedFor(bad), null, bad);
  }
});

test("the new lesson kinds start with something to fill in and keep only what's finished when published", () => {
  const sorting = startingLessonData("SORTING", ids());
  assert.equal(sorting?.groups?.length, 2);
  assert.equal(sorting?.sorts?.length, 4);
  assert.deepEqual(startingLessonData("EXPLORE"), { spots: [] });
  const raw = { groups: [{ id: "g1", name: "Wet waste" }, { id: "g2", name: "Dry waste" }, { id: "g3", name: "" }], sorts: [{ id: "a", text: "Wet towel", group: "g1" }, { id: "b", text: "Box", group: "nope" }, { id: "c", text: "", group: "g2" }] };
  assert.equal(cleanLessonData("SORTING", raw, ids(), true)?.sorts?.length, 3, "a draft keeps unfinished rows");
  const kept = cleanLessonData("SORTING", raw, ids());
  assert.deepEqual(kept?.groups?.map((g) => g.name), ["Wet waste", "Dry waste"]);
  assert.deepEqual(kept?.sorts?.map((s) => s.text), ["Wet towel"], "a row pointing at a missing group is dropped");
  const spots = cleanLessonData("EXPLORE", { spots: [{ id: "s1", x: 140, y: -3, title: "Alarm", text: "Press it" }, { id: "s2", x: 10, y: 10, title: "", text: "" }] });
  assert.deepEqual(spots?.spots?.map((s) => [s.x, s.y]), [[100, 0]]);
  assert.deepEqual(cleanLessonData("ASSIGNMENT", {}), { handIn: { text: "required", photo: "optional", review: true } });
  assert.deepEqual(cleanLessonData("ASSIGNMENT", { handIn: { text: "off", photo: "required", review: false } }), { handIn: { text: "off", photo: "required", review: false } });
});

test("publishing says what each new lesson kind still needs", () => {
  const outline = readOutline({ exam: null, questions: [], sections: [{ id: "s1", title: "Plant room", lessons: [
    lesson("a", "SORTING", { data: { groups: [{ id: "g", name: "Only one" }], sorts: [] } }),
    lesson("b", "EXPLORE"),
    lesson("c", "EMBED", { videoUrl: "https://example.com/deck" }),
    lesson("d", "ASSIGNMENT", { data: { handIn: { text: "off", photo: "off", review: true } } }),
  ] }] });
  const problems = publishProblems(outline).join("\n");
  assert.match(problems, /Lesson a” needs at least two groups/);
  assert.match(problems, /Lesson b” needs the picture/);
  assert.match(problems, /Lesson b” needs at least one spot/);
  assert.match(problems, /Lesson c” needs a link from Google Slides/);
  assert.match(problems, /Lesson d” needs the task written out/);
  assert.match(problems, /Lesson d” must ask for a written answer, a photo or both/);
  const ready = readOutline({ exam: null, questions: [], sections: [{ id: "s1", title: "Plant room", lessons: [
    lesson("c", "EMBED", { videoUrl: "https://docs.google.com/presentation/d/1AbCdEfGhIjK/edit" }),
    lesson("d", "ASSIGNMENT", { body: doc(p("Photograph the test kit after use.")), data: { handIn: { text: "optional", photo: "required", review: true } } }),
  ] }] });
  assert.deepEqual(publishProblems(ready), []);
});

test("tabs, video and file blocks survive cleaning; unsafe ones don't", () => {
  const body = cleanDoc(doc(
    { type: "tabs", content: [{ type: "tab", content: [{ type: "tabTitle", content: [{ type: "text", text: "Day" }] }, { type: "tabContent", content: [p("Open up.")] }] }] },
    { type: "videoEmbed", attrs: { url: "https://youtu.be/dQw4w9WgXcQ", onload: "x" } },
    { type: "videoEmbed", attrs: { url: "javascript:alert(1)" } },
    { type: "fileButton", attrs: { fileId: "file_abc", label: "COSHH sheet" } },
  ));
  assert.ok(body);
  const types = body.content?.map((n) => n.type);
  assert.deepEqual(types, ["tabs", "videoEmbed", "fileButton"], "the unsafe video goes");
  assert.deepEqual(body.content?.[1].attrs, { url: "https://youtu.be/dQw4w9WgXcQ" });
  assert.deepEqual(docFiles(body), ["file_abc"]);
  assert.deepEqual(docVideos(body), ["https://youtu.be/dQw4w9WgXcQ"]);
  assert.ok(cleanDoc(doc({ type: "fileButton", attrs: { fileId: "file_abc", label: "" } })), "a file on its own is not empty text");
});

test("the quality check gives advice without blocking anything", () => {
  const outline = readOutline({ exam: { passMark: 80, attempts: 3, draw: null, timeLimit: null, testOut: false }, questions: [{ id: "q1", sectionId: "s2", kind: "TRUE_FALSE", prompt: "Run?", imageId: null, options: [{ id: "true", text: "True", imageId: null, correct: false, match: "", area: null }, { id: "false", text: "False", imageId: null, correct: true, match: "", area: null }], explanation: "" }], sections: [
    { id: "s1", title: "Arrival", lessons: [
      lesson("a", "READING", { body: doc(p("Welcome."), { type: "image", attrs: { src: "/training/files/f1", alt: "" } }) }),
      lesson("b", "VIDEO", { videoUrl: "https://youtu.be/dQw4w9WgXcQ" }),
      lesson("c", "AUDIO", { fileId: "f2" }),
    ] },
    { id: "s2", title: "Quiz", lessons: [lesson("d", "EXPLORE", { fileId: "f3", data: { spots: [{ id: "x", x: 1, y: 1, title: "Alarm", text: "" }] } })] },
  ] });
  const tips = qualityTips(outline).map((t) => t.text).join("\n");
  assert.match(tips, /An image in “Lesson a” has no description/);
  assert.match(tips, /how many minutes “Lesson b”/);
  assert.match(tips, /“Lesson c” has no transcript/);
  assert.match(tips, /Nothing in “Arrival” checks/);
  assert.match(tips, /exam asks nothing about “Arrival”/);
  assert.match(tips, /1 question doesn’t say why/);
  assert.match(tips, /A spot in “Lesson d”/);
  assert.equal(qualityTips(outline).find((t) => t.text.startsWith("Nothing in “Arrival”"))?.sectionId, "s1");
  assert.ok(!publishProblems(outline).some((m) => /description|transcript/.test(m)));
});

// ---------------------------------------------------------------------------
// Order, prerequisites and hand-ins, end to end
// ---------------------------------------------------------------------------

test("a course to finish first and lessons in order are enforced on the server", async () => {
  as("maya", ["training.manage", "training.assign"]);
  const first = await courses.saveCourse(null, { title: "Pool plant basics", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(first.ok);
  const firstSection = await builder.addSection(first.id, "Basics");
  assert.ok(firstSection.ok);
  const intro = await builder.addLesson(firstSection.id, "READING", "The plant room");
  assert.ok(intro.ok);
  await builder.saveLesson(intro.id, { title: "The plant room", body: JSON.stringify(doc(p("Where it is."))), videoUrl: "", fileId: "", minutes: null });
  assert.equal((await builder.publishCourse(first.id)).ok, true);

  const loop = await courses.saveCourse(first.id, { title: "Pool plant basics", summary: "", requiresSignoff: false, grantsTypeId: "", prerequisiteIds: [first.id] });
  assert.equal(loop.ok, false, "a course can't need itself");

  const second = await courses.saveCourse(null, { title: "Water testing", summary: "", requiresSignoff: false, grantsTypeId: "", lessonsInOrder: true, prerequisiteIds: [first.id] });
  assert.ok(second.ok);
  const back = await courses.saveCourse(first.id, { title: "Pool plant basics", summary: "", requiresSignoff: false, grantsTypeId: "", prerequisiteIds: [second.id] });
  assert.equal(back.ok, false, "no two courses waiting on each other");

  const section = await builder.addSection(second.id, "Testing");
  assert.ok(section.ok);
  const read = await builder.addLesson(section.id, "READING", "How to test");
  const work = await builder.addLesson(section.id, "ASSIGNMENT", "Your test result");
  assert.ok(read.ok && work.ok);
  await builder.saveLesson(read.id, { title: "How to test", body: JSON.stringify(doc(p("Use the kit."))), videoUrl: "", fileId: "", minutes: null });
  await builder.saveLesson(work.id, { title: "Your test result", body: JSON.stringify(doc(p("Write the readings you got."))), videoUrl: "", fileId: "", minutes: null,
    data: JSON.stringify({ handIn: { text: "required", photo: "off", review: true } }) });
  assert.equal((await builder.publishCourse(second.id)).ok, true);
  assert.equal((await courses.assignTraining(second.id, ["ava"], "")).ok, true);
  const assignment = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: second.id } });
  const ava = { id: "ava", name: "ava" };

  const waiting = await course.myCourse("ava", assignment.id);
  assert.deepEqual(waiting?.waitingOn.map((c) => c.title), ["Pool plant basics"]);
  const refused = await course.completeLessonFor(ava, assignment.id, read.id);
  assert.equal(refused.ok, false);
  assert.match(refused.ok ? "" : refused.error, /Pool plant basics/);

  // Finishing the first course opens the second.
  assert.equal((await courses.assignTraining(first.id, ["ava"], "")).ok, true);
  const firstAssignment = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: first.id } });
  assert.equal((await course.completeLessonFor(ava, firstAssignment.id, intro.id)).ok, true);
  assert.equal((await own.completeTrainingFor(ava, firstAssignment.id, "")).ok, true);
  const opened = await course.myCourse("ava", assignment.id);
  assert.deepEqual(opened?.waitingOn, []);
  assert.deepEqual(opened?.sections?.[0].lessons.map((l) => l.locked), [false, true], "the second lesson waits for the first");
  const skip = await handIn.handInWork(ava, assignment.id, work.id, { text: "7.4", file: null, keepFile: false });
  assert.equal(skip.ok, false, "in order means in order");

  assert.equal((await course.completeLessonFor(ava, assignment.id, read.id)).ok, true);
  assert.equal((await handIn.handInWork(ava, assignment.id, work.id, { text: "", file: null, keepFile: false })).ok, false, "the answer is required");
  assert.equal((await handIn.handInWork(ava, assignment.id, work.id, { text: "pH 7.4, chlorine 1.5", file: null, keepFile: false })).ok, true);
  const early = await course.completeLessonFor(ava, assignment.id, work.id);
  assert.equal(early.ok, false, "handed-in work finishes only when a trainer accepts it");

  const submission = await fixture.prisma.trainingSubmission.findFirstOrThrow({ where: { assignmentId: assignment.id } });
  assert.equal(submission.status, "SUBMITTED");
  as("ava", ["training.signoff"]);
  assert.equal((await review.acceptHandIn(submission.id, "")).ok, false, "never your own work");
  as("riley", ["training.signoff", "training.records.read"]);
  assert.equal((await review.returnHandIn(submission.id, "Add the chlorine reading's time.")).ok, true);
  const returned = await course.myLesson("ava", assignment.id, work.id);
  assert.equal(returned?.handIn?.submission?.status, "RETURNED");
  assert.equal(returned?.handIn?.submission?.feedback, "Add the chlorine reading's time.");
  assert.equal((await handIn.handInWork(ava, assignment.id, work.id, { text: "pH 7.4, chlorine 1.5 at 10:00", file: null, keepFile: false })).ok, true);
  assert.equal((await review.acceptHandIn(submission.id, "Good.")).ok, true);
  const done = await fixture.prisma.trainingLessonProgress.findFirst({ where: { assignmentId: assignment.id, lessonId: work.id } });
  assert.ok(done, "accepting it finishes the lesson");
  assert.equal((await handIn.handInWork(ava, assignment.id, work.id, { text: "again", file: null, keepFile: false })).ok, false, "accepted work stays as it was");
  const audit = await fixture.prisma.auditLog.findMany({ where: { entityId: assignment.id }, select: { action: true } });
  assert.ok(["hand-in", "return-work", "accept-work"].every((a) => audit.some((r) => r.action === a)), "every step is audited");
});
