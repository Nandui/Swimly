import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { cleanDoc, lessonPlace, plainTextDoc, publishProblems, readOutline, videoFor, type Outline } from "../shared/lessons";

/** E-learning (docs/training.md, phase 1) against a real in-memory Postgres:
 *  authors build and publish versions, learners take the published version
 *  lesson by lesson, finishing needs every lesson, and people part-way
 *  through keep the version they started. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let builder: typeof import("../features/builder/server/actions");
let courses: typeof import("../features/courses/server/actions") & typeof import("../features/assignments/server/actions");
let course: typeof import("../features/me/server/course");
let own: typeof import("../features/me/server/self");
let mine: typeof import("../features/me/server/mine");
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
  mine = serverModule("src/modules/training/features/me/server/mine.ts", doubles());
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("lesson text keeps only safe nodes, links and the course's own images", () => {
  const cleaned = cleanDoc({ type: "doc", content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Free chlorine" }] },
    { type: "paragraph", content: [{ type: "text", text: "Click", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }, { type: "bold" }] }] },
    { type: "image", attrs: { src: "https://evil.example/x.png" } },
    { type: "image", attrs: { src: "/training/files/abc123", alt: "Test kit", onerror: "x" } },
    { type: "script", content: [{ type: "text", text: "no" }] },
  ] });
  assert.deepEqual(cleaned, { type: "doc", content: [
    { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Free chlorine" }] },
    { type: "paragraph", content: [{ type: "text", text: "Click", marks: [{ type: "bold" }] }] },
    { type: "image", attrs: { src: "/training/files/abc123", alt: "Test kit" } },
  ] });
  assert.equal(cleanDoc({ type: "doc", content: [{ type: "paragraph" }] }), null, "empty text is no text");
  assert.equal(cleanDoc("<p>html</p>"), null);
});

test("video links play in place for YouTube and Vimeo, and open elsewhere otherwise", () => {
  assert.equal(videoFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")?.embed, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&start=42");
  assert.equal(videoFor("https://youtu.be/dQw4w9WgXcQ")?.embed, "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  assert.equal(videoFor("https://vimeo.com/123456789")?.embed, "https://player.vimeo.com/video/123456789");
  assert.deepEqual(videoFor("https://leisureworld.sharepoint.com/v/abc"), { href: "https://leisureworld.sharepoint.com/v/abc", provider: "leisureworld.sharepoint.com", embed: null });
  assert.equal(videoFor("http://youtube.com/watch?v=dQw4w9WgXcQ"), null, "https only");
  assert.equal(videoFor("not a link"), null);
});

test("a draft says what stops it publishing", () => {
  const outline: Outline = { sections: [
    { id: "s1", title: "Start", lessons: [
      { id: "l1", kind: "READING", title: "Read", body: null, videoUrl: "", fileId: null, minutes: null },
      { id: "l2", kind: "VIDEO", title: "Watch", body: null, videoUrl: "ftp://x", fileId: null, minutes: null },
      { id: "l3", kind: "FILE", title: "Open", body: null, videoUrl: "", fileId: null, minutes: null },
    ] },
    { id: "s2", title: "Empty", lessons: [] },
  ], questions: [], exam: null };
  assert.equal(publishProblems(outline).length, 4);
  assert.deepEqual(publishProblems({ sections: [], questions: [], exam: null }), ["Add at least one lesson."]);
  const place = lessonPlace(outline, "l2");
  assert.deepEqual([place?.index, place?.total, place?.prev, place?.next], [1, 3, "l1", "l3"]);
  assert.deepEqual(plainTextDoc("Line one\nline two\n\nNext"), { type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Line one" }, { type: "hardBreak" }, { type: "text", text: "line two" }] },
    { type: "paragraph", content: [{ type: "text", text: "Next" }] },
  ] });
  assert.deepEqual(readOutline({ sections: [{ id: "s", title: "T", lessons: [{ id: "x", kind: "SCORM" }] }] }), { exam: null, questions: [], sections: [{ id: "s", title: "T", lessons: [] }] });
});

// ---------------------------------------------------------------------------
// Building, publishing and taking a course
// ---------------------------------------------------------------------------

let courseId = "", lessons: string[] = [];
test("an author builds a course from sections and lessons and publishes it; others cannot", async () => {
  as("maya", ["training.manage", "training.assign"]);
  const created = await courses.saveCourse(null, { title: "Pool plant basics", summary: "", requiresSignoff: false, grantsTypeId: "" });
  assert.ok(created.ok);
  courseId = created.id;
  as("riley", ["training.records.read"]);
  assert.equal((await builder.addSection(courseId, "Before you start")).ok, false, "reading records is not authoring");
  as("maya", ["training.manage"]);
  assert.equal((await builder.publishCourse(courseId)).ok, false, "nothing to publish");
  const s1 = await builder.addSection(courseId, "Before you start");
  const s2 = await builder.addSection(courseId, "Testing the water");
  assert.ok(s1.ok && s2.ok);
  const a = await builder.addLesson(s1.id, "READING", "Why we test");
  const b = await builder.addLesson(s2.id, "VIDEO", "Using the kit");
  const c = await builder.addLesson(s2.id, "READING", "Recording results");
  assert.ok(a.ok && b.ok && c.ok);
  lessons = [a.id, b.id, c.id];
  const unfinished = await builder.publishCourse(courseId);
  assert.equal(unfinished.ok, false);
  assert.match(unfinished.ok ? "" : unfinished.error, /no text yet/);
  assert.equal((await builder.saveLesson(a.id, { title: "Why we test", body: JSON.stringify(doc("Chlorine keeps the water safe.")), videoUrl: "", fileId: "", minutes: null })).ok, true);
  assert.equal((await builder.saveLesson(b.id, { title: "Using the kit", body: null, videoUrl: "https://example.com/not-https-video", fileId: "", minutes: 4 })).ok, true);
  assert.equal((await builder.saveLesson(b.id, { title: "Using the kit", body: null, videoUrl: "http://insecure.example", fileId: "", minutes: 4 })).ok, false, "https only");
  assert.equal((await builder.saveLesson(c.id, { title: "Recording results", body: JSON.stringify(doc("Write every test in the log.")), videoUrl: "", fileId: "nope", minutes: null })).ok, true, "a File id on a reading lesson is ignored");
  assert.equal((await builder.saveLesson(a.id, { title: "Why we test", body: JSON.stringify({ type: "doc", content: [{ type: "image", attrs: { src: "/training/files/missing" } }] }), videoUrl: "", fileId: "", minutes: null })).ok, false, "images must be this course's files");
  assert.equal((await builder.publishCourse(courseId)).ok, true);
  const v1 = await fixture.prisma.trainingCourseVersion.findFirstOrThrow({ where: { courseId } });
  assert.equal(v1.number, 1);
  assert.equal(v1.lessonCount, 3);
  assert.equal((await fixture.prisma.trainingCourse.findUniqueOrThrow({ where: { id: courseId } })).publishedVersionId, v1.id);
  assert.equal(await fixture.prisma.auditLog.count({ where: { entity: "TrainingCourse", entityId: courseId, action: "publish" } }), 1);
});

test("lessons move within and across sections", async () => {
  as("maya", ["training.manage"]);
  assert.equal((await builder.moveLesson(lessons[1], "up")).ok, true, "first in its section: moves to the end of the one before");
  const moved = await fixture.prisma.trainingLesson.findUniqueOrThrow({ where: { id: lessons[1] }, select: { section: { select: { title: true } } } });
  assert.equal(moved.section.title, "Before you start");
  assert.equal((await builder.moveLesson(lessons[1], "down")).ok, true);
  assert.equal((await fixture.prisma.trainingLesson.findUniqueOrThrow({ where: { id: lessons[1] }, select: { section: { select: { title: true } } } })).section.title, "Testing the water");
});

test("the learner takes the published version lesson by lesson, and finishes only when every lesson is done", async () => {
  as("maya", ["training.manage", "training.assign"]);
  assert.equal((await courses.assignTraining(courseId, ["ava", "riley"], "")).ok, true);
  const ava = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "ava", courseId } });
  const outline = await course.myCourse("ava", ava.id);
  assert.deepEqual(outline?.sections.map((s) => s.lessons.map((l) => l.id)), [[lessons[0]], [lessons[1], lessons[2]]]);
  assert.deepEqual([outline?.done, outline?.total, outline?.nextLessonId], [0, 3, lessons[0]]);
  assert.equal(await course.myCourse("noah", ava.id), null, "someone else's training is not there");
  assert.equal((await own.completeTrainingFor(me("ava"), ava.id, "")).ok, false, "lessons first");
  assert.equal((await course.completeLessonFor(me("noah"), ava.id, lessons[0])).ok, false);
  assert.equal((await course.completeLessonFor(me("ava"), ava.id, "not-a-lesson")).ok, false);
  assert.equal((await course.completeLessonFor(me("ava"), ava.id, lessons[0])).ok, true);
  assert.equal((await course.completeLessonFor(me("ava"), ava.id, lessons[0])).ok, true, "finishing twice is harmless");
  const lesson = await course.myLesson("ava", ava.id, lessons[1]);
  assert.deepEqual([lesson?.index, lesson?.prev, lesson?.next, lesson?.done, lesson?.video?.embed], [1, lessons[0], lessons[2], false, null]);
  const list = await mine.myTraining("ava");
  assert.deepEqual(list.find((r) => r.id === ava.id)?.progress, { done: 1, total: 3, nextLessonId: lessons[1] });
  assert.ok((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: ava.id } })).versionId, "the first lesson fixes the version");
  for (const id of lessons.slice(1)) assert.equal((await course.completeLessonFor(me("ava"), ava.id, id)).ok, true);
  assert.equal((await own.completeTrainingFor(me("ava"), ava.id, "")).ok, true);
  assert.equal((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: ava.id } })).status, "COMPLETED");
  assert.equal((await course.completeLessonFor(me("ava"), ava.id, lessons[0])).ok, false, "a finished course takes no more lessons");
});

test("a new version reaches people who haven't started; people part-way through keep theirs", async () => {
  const riley = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "riley", courseId } });
  as("maya", ["training.manage", "training.assign"]);
  assert.equal((await courses.assignTraining(courseId, ["noah"], "")).ok, true);
  const noah = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "noah", courseId } });
  assert.equal((await course.completeLessonFor(me("noah"), noah.id, lessons[0])).ok, true, "noah starts on version 1");
  const section = await fixture.prisma.trainingSection.findFirstOrThrow({ where: { courseId, title: "Testing the water" } });
  const extra = await builder.addLesson(section.id, "READING", "Shocking the pool");
  assert.ok(extra.ok);
  await builder.saveLesson(extra.id, { title: "Shocking the pool", body: JSON.stringify(doc("Only with the plant room lead.")), videoUrl: "", fileId: "", minutes: 3 });
  assert.equal((await builder.publishCourse(courseId)).ok, true);
  assert.equal((await course.myCourse("riley", riley.id))?.total, 4, "riley hadn't started: version 2");
  assert.equal((await course.myCourse("noah", noah.id))?.total, 3, "noah keeps version 1");
  assert.equal(await course.myLesson("noah", noah.id, extra.id), null, "and can't open version 2's lessons");
});

test("a course from before lessons turns its text into lesson 1, and old training keeps working", async () => {
  as("maya", ["training.manage", "training.assign"]);
  const old = await fixture.prisma.trainingCourse.create({ data: { orgId: ORG, title: "Fire drill", content: "Leave by the nearest exit.\n\nMeet at the car park." } });
  assert.equal((await courses.assignTraining(old.id, ["riley"], "")).ok, true);
  const riley = await fixture.prisma.trainingAssignment.findFirstOrThrow({ where: { userId: "riley", courseId: old.id } });
  assert.equal(await course.myCourse("riley", riley.id), null, "no lessons: the old text");
  const started = await builder.startFromOldText(old.id);
  assert.ok(started.ok);
  assert.equal((await builder.startFromOldText(old.id)).ok, false, "only once");
  assert.equal(await course.myCourse("riley", riley.id), null, "nothing changes for learners until it's published");
  assert.equal((await own.completeTrainingFor(me("riley"), riley.id, "")).ok, true, "and the old way still completes it");
});
