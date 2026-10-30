import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import {
  cleanDoc, docActivities, frozenOutline, lessonHandIn, lessonHasQuiz, lessonShows, pageFromLesson, publishProblems, readOutline, type DocNode, type LessonKind,
} from "../shared/lessons";

/** One place to put content in a lesson (owner decision D18, 30 October 2026):
 *  a new lesson is a page built with Add, the Practice quiz and Hand in work are
 *  blocks, and an older lesson becomes a page the first time it is saved. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
let handIn: typeof import("../features/me/server/hand-in");
let exam: typeof import("../features/me/server/exam");
const ORG = "org_leisureworld";
const state = { id: "maya", permissions: [] as string[] };

function session() {
  return { user: { id: state.id, name: state.id, orgId: ORG, isSuperadmin: false, roleName: "Role", permissions: state.permissions, primaryPermissions: state.permissions, screens: ["training"], primaryScreens: ["training"], grants: [], authMethod: "password", authAt: Date.now() } };
}
const p = (text: string): DocNode => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: DocNode[]): DocNode => ({ type: "doc", content });
const activity = (id: string, kind: string, data: object | null = null): DocNode => ({ type: "activity", attrs: { id, kind, data } });
const lesson = (kind: LessonKind, extra: object = {}) => ({ id: "l1", kind, title: "Opening up", body: null, videoUrl: "", fileId: null, minutes: null, data: null, ...extra });

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
  exam = serverModule("src/modules/training/features/me/server/exam.ts", mods);
});
after(async () => { await fixture?.close(); });

test("an older lesson's main part becomes the first block of a page, its text after", () => {
  const notes = doc(p("Watch it twice."));
  const video = pageFromLesson(lesson("VIDEO", { videoUrl: "https://youtu.be/dQw4w9WgXcQ", body: notes }));
  assert.deepEqual(video?.content?.map((n) => n.type), ["videoEmbed", "paragraph"]);
  assert.deepEqual(pageFromLesson(lesson("AUDIO", { fileId: "rec1" }))?.content?.[0], { type: "audioBlock", attrs: { fileId: "rec1", transcript: "" } });
  assert.equal(pageFromLesson(lesson("EMBED", { videoUrl: "https://docs.google.com/presentation/d/1AbCdEfGhIjKlMnOp/edit" }))?.content?.[0].type, "slidesBlock");
  assert.deepEqual(pageFromLesson(lesson("FILE", { fileId: "pdf1" }))?.content?.[0], { type: "fileView", attrs: { fileId: "pdf1" } });
  const checklist = pageFromLesson(lesson("CHECKLIST", { data: { items: [{ id: "i1", text: "Lights on" }] } }), () => "blk1");
  assert.deepEqual(docActivities(checklist).map((b) => [b.id, b.kind, b.data?.items?.[0].text]), [["blk1", "CHECKLIST", "Lights on"]]);
  const work = pageFromLesson(lesson("ASSIGNMENT", { body: doc(p("Photograph the test kit.")), data: { handIn: { text: "off", photo: "required", review: true } } }), () => "blk2");
  assert.deepEqual(work?.content?.map((n) => n.type), ["paragraph", "activity"], "the task stays first, Hand in work goes after it");
  assert.equal(lessonHandIn({ kind: "READING", body: work, data: null })?.photo, "required");
  assert.equal(pageFromLesson(lesson("READING", { body: notes })), notes, "a page is already a page");
  assert.equal(pageFromLesson(lesson("VIDEO", { videoUrl: "javascript:alert(1)" })), null, "nothing safe to keep");
});

test("a page shows as its first activity, else its first media, else as reading", () => {
  assert.equal(lessonShows({ kind: "VIDEO", body: null }), "VIDEO", "an older lesson keeps its kind");
  assert.equal(lessonShows({ kind: "READING", body: cleanDoc(doc(p("Hi"), { type: "audioBlock", attrs: { fileId: "rec1", transcript: "" } }, activity("a", "SCENARIO", { steps: [] }))) }), "SCENARIO");
  assert.equal(lessonShows({ kind: "READING", body: cleanDoc(doc(p("Hi"), { type: "audioBlock", attrs: { fileId: "rec1", transcript: "" } })) }), "AUDIO");
  assert.equal(lessonShows({ kind: "READING", body: cleanDoc(doc(p("Hi"))) }), "READING");
});

test("the Practice quiz and Hand in work are blocks, one of each per lesson", () => {
  const page = cleanDoc(doc(p("Test the water, then hand in your readings."), activity("q", "QUIZ"), activity("h", "ASSIGNMENT", { handIn: { text: "required", photo: "off", review: false } })));
  assert.equal(lessonHasQuiz({ kind: "READING", body: page }), true);
  assert.deepEqual(lessonHandIn({ kind: "READING", body: page, data: null }), { text: "required", photo: "off", review: false });
  assert.equal(lessonHandIn({ kind: "READING", body: cleanDoc(doc(p("Hi"))), data: null }), null);
  const outline = (body: DocNode | null) => frozenOutline(readOutline({ exam: null, questions: [], sections: [{ id: "s1", title: "Start", lessons: [{ ...lesson("READING"), body }] }] }));
  assert.ok(publishProblems(outline(page)).some((x) => x.includes("needs questions")), "a quiz block needs the section's questions");
  const twice = cleanDoc(doc(p("Hi"), activity("a", "ASSIGNMENT", { handIn: { text: "required", photo: "off", review: true } }), activity("b", "ASSIGNMENT", { handIn: { text: "required", photo: "off", review: true } })));
  assert.ok(publishProblems(outline(twice)).some((x) => x.includes("more than one hand in work")));
  const untold = cleanDoc(doc(activity("a", "ASSIGNMENT", { handIn: { text: "off", photo: "off", review: true } })));
  const problems = publishProblems(outline(untold));
  assert.ok(problems.some((x) => x.includes("task written out")) && problems.some((x) => x.includes("written answer, a photo or both")));
});

test("saving from the builder turns an older lesson into a page; learners then quiz and hand in from its blocks", async () => {
  Object.assign(state, { id: "maya", permissions: ["training.manage", "training.assign"] });
  const made = await courses.saveCourse(null, { title: "Water testing", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(made.ok);
  const section = await builder.addSection(made.id, "Testing");
  assert.ok(section.ok);
  await fixture.prisma.trainingQuestion.create({ data: { courseId: made.id, sectionId: section.id, position: 1, kind: "TRUE_FALSE", prompt: "Test before opening?",
    options: [{ id: "true", text: "True", imageId: null, correct: true, match: "" }, { id: "false", text: "False", imageId: null, correct: false, match: "" }] } });
  const old = await builder.addLesson(section.id, "CHECKLIST", "Before opening");
  assert.ok(old.ok);
  const page = doc(p("Check, practise, then send your readings."), activity("ck", "CHECKLIST", { items: [{ id: "i1", text: "Kit ready" }] }), activity("qz", "QUIZ"),
    activity("hi", "ASSIGNMENT", { handIn: { text: "required", photo: "off", review: true } }));
  assert.equal((await builder.saveLesson(old.id, { title: "Before opening", body: JSON.stringify(page), videoUrl: "", fileId: "", minutes: null, data: null, page: true })).ok, true);
  const row = await fixture.prisma.trainingLesson.findUniqueOrThrow({ where: { id: old.id } });
  assert.deepEqual([row.kind, row.data], ["READING", null], "now a page");
  assert.equal((await builder.publishCourse(made.id)).ok, true);
  assert.equal((await courses.assignTraining(made.id, ["ava"], "")).ok, true);
  const assignment = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId: made.id } });

  const seen = await course.myLesson("ava", assignment.id, old.id);
  assert.equal(seen?.questions?.length, 1, "the quiz block brings the section's questions");
  assert.ok(seen?.handIn, "and Hand in work");
  assert.equal((await course.myCourse("ava", assignment.id))?.sections[0].lessons[0].kind, "CHECKLIST", "shown as its first activity");
  const question = seen!.questions![0];
  assert.equal((await exam.checkQuizAnswer("ava", assignment.id, old.id, question.id, "true", false))?.correct, true, "the quiz block's answers are checked");

  const ava = { id: "ava", name: "ava" };
  assert.equal((await course.completeLessonFor(ava, assignment.id, old.id)).ok, false, "not before handing in");
  assert.equal((await handIn.handInWork(ava, assignment.id, old.id, { text: "Free chlorine 1.5", file: null, keepFile: false, at: null })).ok, true);
  assert.equal((await course.completeLessonFor(ava, assignment.id, old.id)).ok, false, "a trainer checks it first");
});
