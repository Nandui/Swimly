import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { isolatedPrisma } from "@/test/pglite-prisma";
import { serverModule } from "@/test/server-module";
import { badgesFor, matchScore, nextCard, searchWords, snippetOf, streakOf } from "../shared/learner";

/** The learner's own space (e-learning phase 6): search,
 *  bookmarks and notes, daily refreshers, streaks and badges, the catalogue,
 *  ratings and the record. Pure rules first, then against a real in-memory
 *  Postgres. */
let fixture: Awaited<ReturnType<typeof isolatedPrisma>>;
let learner: typeof import("../features/me/server/learner");
let refresher: typeof import("../features/me/server/refresher");
let exam: typeof import("../features/me/server/exam");
let catalogue: typeof import("../features/me/server/catalogue");
let feedback: typeof import("../features/me/server/feedback");
let record: typeof import("../features/me/server/record");
const ORG = "org_leisureworld";
let course = "", version = "", open = "", done = "";

const outline = {
  exam: { passMark: 50, attempts: 3, draw: null, timeLimit: null, testOut: false },
  sections: [{ id: "sec1", title: "Chemicals", lessons: [
    { id: "l1", kind: "READING", title: "Storing chlorine", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Keep sodium hypochlorite away from acid. Wear goggles and gloves." }] }] }, videoUrl: "", fileId: null, minutes: 3, data: null },
    { id: "l2", kind: "QUIZ", title: "Check yourself", body: null, videoUrl: "", fileId: null, minutes: 2, data: null },
  ] }],
  questions: [
    { id: "q1", sectionId: "sec1", kind: "SINGLE", prompt: "What do you keep chlorine away from?", imageId: null, explanation: "Mixing them releases chlorine gas.",
      options: [{ id: "a", text: "Acid", imageId: null, correct: true, match: "", area: null }, { id: "b", text: "Water", imageId: null, correct: false, match: "", area: null }] },
    { id: "q2", sectionId: "sec1", kind: "TRUE_FALSE", prompt: "Gloves are optional.", imageId: null, explanation: "Always wear them.",
      options: [{ id: "t", text: "True", imageId: null, correct: false, match: "", area: null }, { id: "f", text: "False", imageId: null, correct: true, match: "", area: null }] },
  ],
};

function doubles() {
  return {
    "@/lib/prisma": { prisma: fixture.prisma },
    "next/cache": { revalidatePath() {} },
    "@/lib/clubs/current": { currentClubId: async () => "club_bishopstown", currentClubIdIfAny: async () => null },
    "@/lib/authz": { AuthorizationError: class extends Error {}, requireSession: async () => { throw new Error("no session in Me"); }, can: () => false, canSee: () => false },
    "next/navigation": { notFound: () => { throw new Error("not found"); } },
    "server-only": {},
    react: { cache: <T,>(fn: T) => fn },
  };
}
const ava = { id: "ava", name: "Ava" };

before(async () => {
  fixture = await isolatedPrisma();
  const db = fixture.prisma;
  await db.organisation.upsert({ where: { id: ORG }, create: { id: ORG, name: "LeisureWorld", slug: "leisureworld-test" }, update: {} });
  await db.staffRole.create({ data: { id: "r-staff", name: "Staff", permissions: [], screens: [] } });
  for (const id of ["ava", "noah"]) await db.user.create({ data: { id, name: id, email: `${id}@example.invalid`, staffRoleId: "r-staff", orgId: ORG, jobTitle: "", siteIds: [] } });
  course = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic chemical handling", summary: "Storing and handling pool chemicals", category: "Plant room", tags: ["chemicals"] } })).id;
  version = (await db.trainingCourseVersion.create({ data: { courseId: course, number: 1, outline, lessonCount: 2, publishedByName: "maya" } })).id;
  await db.trainingCourse.update({ where: { id: course }, data: { publishedVersionId: version } });
  open = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: course, userId: "ava", assignedByName: "maya" } })).id;
  const old = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic first aid basics", publishedVersionId: null } })).id;
  done = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: old, userId: "ava", assignedByName: "maya", status: "COMPLETED", completedAt: new Date() } })).id;
  const mods = doubles();
  learner = serverModule("src/modules/training/features/me/server/learner.ts", mods);
  refresher = serverModule("src/modules/training/features/me/server/refresher.ts", mods);
  exam = serverModule("src/modules/training/features/me/server/exam.ts", mods);
  catalogue = serverModule("src/modules/training/features/me/server/catalogue.ts", mods);
  feedback = serverModule("src/modules/training/features/me/server/feedback.ts", mods);
  record = serverModule("src/modules/training/features/me/server/record.ts", mods);
});
after(async () => { await fixture?.close(); });

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------

test("a right answer moves a card up a box, further apart; a wrong one sends it back to tomorrow", () => {
  assert.deepEqual(nextCard(1, true, "2026-10-15"), { box: 2, dueOn: "2026-10-17" });
  assert.deepEqual(nextCard(4, true, "2026-10-15"), { box: 5, dueOn: "2026-10-31" });
  assert.deepEqual(nextCard(5, true, "2026-10-15"), { box: 5, dueOn: "2026-10-31" });
  assert.deepEqual(nextCard(5, false, "2026-10-15"), { box: 1, dueOn: "2026-10-16" });
});

test("a streak runs to today, or to yesterday while today is still open, and the best is kept", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-13", "2026-10-14"];
  assert.deepEqual(streakOf(days, "2026-10-15"), { current: 2, best: 4, today: false });
  assert.deepEqual(streakOf([...days, "2026-10-15"], "2026-10-15"), { current: 3, best: 4, today: true });
  assert.equal(streakOf(days, "2026-10-17").current, 0);
  assert.deepEqual(streakOf([], "2026-10-15"), { current: 0, best: 0, today: false });
});

test("badges are worked out from the record", () => {
  const none = badgesFor({ coursesDone: 0, perfectExam: false, firstTimePass: false, bestStreak: 0, refresherAnswers: 0, hoursMet: false, pathDone: false });
  assert.ok(none.every((b) => !b.earned));
  const some = badgesFor({ coursesDone: 5, perfectExam: true, firstTimePass: false, bestStreak: 7, refresherAnswers: 50, hoursMet: true, pathDone: false });
  assert.deepEqual(some.filter((b) => b.earned).map((b) => b.id), ["first-course", "five-courses", "full-marks", "streak-3", "streak-7", "refresher-50", "hours-met"]);
});

test("search needs every word, ranks the title higher and shows the text around the match", () => {
  assert.deepEqual(searchWords("Chlorine, a  ACID!"), ["chlorine", "acid"]);
  assert.equal(matchScore(["chlorine", "acid"], "Storing chlorine", "keep away from acid"), 4);
  assert.equal(matchScore(["chlorine", "ozone"], "Storing chlorine", "keep away from acid"), 0);
  assert.match(snippetOf(["acid"], `${"word ".repeat(60)}keep it away from acid always`), /^….*acid/);
});

// ---------------------------------------------------------------------------
// Against the database
// ---------------------------------------------------------------------------

test("search finds the learner's own courses and lessons, never someone else's", async () => {
  const found = await learner.searchMyTraining("ava", "hypochlorite goggles");
  assert.deepEqual(found.lessons.map((l) => l.lessonId), ["l1"]);
  assert.match(found.lessons[0].snippet, /hypochlorite/);
  assert.equal((await learner.searchMyTraining("ava", "plant room")).courses[0]?.assignmentId, open);
  assert.equal((await learner.searchMyTraining("noah", "hypochlorite")).lessons.length, 0);
});

test("bookmarks and notes are private, audited without the words, and cleared when both are empty", async () => {
  assert.ok((await learner.saveLessonNote(ava, open, "l1", { bookmarked: true })).ok);
  assert.ok((await learner.saveLessonNote(ava, open, "l1", { note: "Goggles live in the plant room cupboard" })).ok);
  assert.deepEqual(await learner.myLessonNote("ava", open, "l1"), { bookmarked: true, note: "Goggles live in the plant room cupboard" });
  assert.deepEqual(await learner.myLessonNote("noah", open, "l1"), { bookmarked: false, note: "" });
  assert.equal((await learner.saveLessonNote({ id: "noah", name: "Noah" }, open, "l1", { bookmarked: true })).ok, false);
  assert.equal((await learner.saveLessonNote(ava, open, "nope", { bookmarked: true })).ok, false);
  const saved = await learner.mySaved("ava");
  assert.equal(saved.length, 1);
  assert.equal(saved[0].title, "Storing chlorine");
  const audits = await fixture.prisma.auditLog.findMany({ where: { entityId: open }, select: { summary: true } });
  assert.ok(audits.some((a) => a.summary === "Bookmarked the lesson Storing chlorine"));
  assert.ok(audits.every((a) => !a.summary.includes("cupboard")));
  await learner.saveLessonNote(ava, open, "l1", { bookmarked: false, note: "" });
  assert.equal(await fixture.prisma.trainingLessonNote.count({ where: { assignmentId: open } }), 0);
});

test("a missed practice question comes back in the refresher, and moves on when right", async () => {
  const wrong = await exam.checkQuizAnswer("ava", open, "l2", "q1", "b", false);
  assert.equal(wrong?.correct, false);
  const card = await fixture.prisma.trainingRefresherCard.findFirstOrThrow({ where: { userId: "ava", questionId: "q1" } });
  assert.equal(card.box, 1);
  // Not due until tomorrow.
  assert.equal((await refresher.myRefresher("ava", ORG)).questions.length, 0);
  assert.equal(await refresher.refresherWaiting("ava"), 0, "nothing waiting on Me's home yet");
  await fixture.prisma.trainingRefresherCard.update({ where: { id: card.id }, data: { dueOn: new Date("2026-01-01") } });
  const today = await refresher.myRefresher("ava", ORG);
  assert.deepEqual(today.questions.map((q) => q.questionId), ["q1"]);
  assert.equal(await refresher.refresherWaiting("ava"), 1);
  assert.equal(await refresher.refresherWaiting("noah"), 0, "never another person's card");
  // The key never travels: options carry no "correct".
  assert.ok(today.questions[0].question.options.every((o) => !("correct" in o)));
  const right = await refresher.answerRefresher("ava", { cardId: card.id }, "a");
  assert.ok(right && !right.done && right.correct);
  assert.equal(right.nextIn, 2);
  // Once a day only.
  assert.deepEqual(await refresher.answerRefresher("ava", { cardId: card.id }, "a"), { done: true });
  assert.equal((await refresher.answerRefresher("noah", { cardId: card.id }, "a")), null);
  const after = await refresher.myRefresher("ava", ORG);
  assert.equal(after.answered, 1);
  assert.equal(after.streak.current, 1);
  assert.equal(after.questions.length, 0);
  assert.equal(await refresher.refresherWaiting("ava"), 0, "answered, nothing left waiting");
});

test("only a passed exam turns its wrong answers into refresher cards", async () => {
  await fixture.prisma.trainingRefresherCard.deleteMany({});
  for (const id of ["l1", "l2"]) await fixture.prisma.trainingLessonProgress.create({ data: { assignmentId: open, lessonId: id } });
  const first = await exam.startExam(ava, open);
  assert.ok(first.ok && "paper" in first);
  await exam.saveExamAnswer(ava, open, first.paper.id, "q1", "b");
  await exam.saveExamAnswer(ava, open, first.paper.id, "q2", "t");
  await exam.submitExam(ava, open, first.paper.id);
  assert.equal(await fixture.prisma.trainingRefresherCard.count(), 0, "a failed paper adds nothing");
  const second = await exam.startExam(ava, open);
  assert.ok(second.ok && "paper" in second);
  await exam.saveExamAnswer(ava, open, second.paper.id, "q1", "a");
  await exam.saveExamAnswer(ava, open, second.paper.id, "q2", "t");
  await exam.submitExam(ava, open, second.paper.id);
  const cards = await fixture.prisma.trainingRefresherCard.findMany({ select: { questionId: true } });
  assert.deepEqual(cards.map((c) => c.questionId), ["q2"]);
  assert.equal((await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: open } })).status, "COMPLETED");
});

test("a finished course can be rated once and changed; authors get it without names", async () => {
  assert.equal((await feedback.rateCourse({ id: "noah", name: "Noah" }, open, { rating: 5, unclear: "" })).ok, false);
  assert.equal((await feedback.rateCourse(ava, open, { rating: 9, unclear: "" })).ok, false);
  assert.ok((await feedback.rateCourse(ava, open, { rating: 4, unclear: "The storage diagram was small" })).ok);
  assert.ok((await feedback.rateCourse(ava, open, { rating: 3, unclear: "The storage diagram was small" })).ok);
  assert.deepEqual(await feedback.myFeedback("ava", open), { rating: 3, unclear: "The storage diagram was small" });
  assert.equal(await fixture.prisma.trainingFeedback.count(), 1);
});

test("the catalogue shows only open, published courses, and enrolling assigns once with an audit", async () => {
  assert.equal((await catalogue.catalogueFor("noah", ORG)).length, 0);
  assert.equal((await catalogue.enrolMyself({ id: "noah", name: "Noah", orgId: ORG }, course)).ok, false);
  await fixture.prisma.trainingCourse.update({ where: { id: course }, data: { selfEnrol: true } });
  const list = await catalogue.catalogueFor("noah", ORG);
  assert.deepEqual(list.map((c) => [c.title, c.lessons, c.exam, c.mine]), [["Synthetic chemical handling", 2, true, null]]);
  assert.equal(list[0].rating, null, "fewer than three ratings stay hidden");
  const first = await catalogue.enrolMyself({ id: "noah", name: "Noah", orgId: ORG }, course);
  const again = await catalogue.enrolMyself({ id: "noah", name: "Noah", orgId: ORG }, course);
  assert.ok(first.ok && again.ok && again.already && first.assignmentId === again.assignmentId);
  const row = await fixture.prisma.trainingAssignment.findUniqueOrThrow({ where: { id: first.assignmentId } });
  assert.equal(row.dueOn, null);
  assert.ok(await fixture.prisma.auditLog.findFirst({ where: { entityId: first.assignmentId, summary: { contains: "Enrolled themselves" } } }));
  assert.deepEqual((await catalogue.catalogueFor("noah", ORG))[0].mine, { assignmentId: first.assignmentId, state: "open" });
  await fixture.prisma.trainingCourse.update({ where: { id: course }, data: { archivedAt: new Date() } });
  assert.equal((await catalogue.catalogueFor("noah", ORG)).length, 0);
  await fixture.prisma.trainingCourse.update({ where: { id: course }, data: { archivedAt: null } });
});

test("my record lists every course with its best exam score, and badges count it", async () => {
  const mine = await record.myRecord("ava", ORG);
  const chem = mine.courses.find((c) => c.id === open)!;
  assert.equal(chem.state, "completed");
  assert.deepEqual(chem.exam, { attempts: 2, best: 50, passed: true });
  assert.equal(chem.version, 1);
  assert.ok(mine.courses.some((c) => c.id === done));
  const today = await refresher.myRefresher("ava", ORG);
  const earned = today.badges.filter((b) => b.earned).map((b) => b.id);
  assert.ok(earned.includes("first-course") && !earned.includes("first-time"));
});

test("a catalogue course's cover is shown only while the course is open to all, and only its own picture", async () => {
  const db = fixture.prisma;
  const other = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic other course" } })).id;
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cover = (await db.trainingFile.create({ data: { courseId: course, name: "cover.png", mime: "image/png", size: bytes.length, bytes, addedByName: "maya" } })).id;
  const stray = (await db.trainingFile.create({ data: { courseId: other, name: "stray.png", mime: "image/png", size: bytes.length, bytes, addedByName: "maya" } })).id;
  await db.trainingCourse.update({ where: { id: course }, data: { coverId: cover, selfEnrol: false } });
  assert.equal(await catalogue.catalogueCover(ORG, course), null, "not in the catalogue, no picture");
  await db.trainingCourse.update({ where: { id: course }, data: { selfEnrol: true } });
  const shown = await catalogue.catalogueCover(ORG, course);
  assert.deepEqual([shown?.id, shown?.name, shown?.mime], [cover, "cover.png", "image/png"]);
  assert.equal(await catalogue.catalogueCover("org_elsewhere", course), null, "another organisation's catalogue");
  await db.trainingCourse.update({ where: { id: course }, data: { coverId: stray } });
  assert.equal(await catalogue.catalogueCover(ORG, course), null, "a picture from another course is never served");
  await db.trainingCourse.update({ where: { id: course }, data: { coverId: null, selfEnrol: false } });
});

test("Training's front door gives Turnfin Me only the files in the person's own course and their own handed-in work, safely served", async () => {
  const db = fixture.prisma;
  const front = serverModule<typeof import("@/modules/training")>("src/modules/training/index.ts", doubles());
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const filed = (await db.trainingCourse.create({ data: { orgId: ORG, title: "Synthetic plant room tour" } })).id;
  const add = async (name: string, courseId = filed) => (await db.trainingFile.create({ data: { courseId, name, mime: "image/png", size: png.length, bytes: png, addedByName: "maya" } })).id;
  const [lessonFile, inText, onQuestion, cover, unused] = [await add("diagram.png"), await add("valve.png"), await add("label.png"), await add("cover.png"), await add("draft-only.png")];
  const elsewhere = await add("elsewhere.png", course);
  const outline = {
    exam: null,
    sections: [{ id: "s1", title: "Tour", lessons: [
      { id: "f1", kind: "FILE", title: "Plant room map", body: null, videoUrl: "", fileId: lessonFile, minutes: 2, data: null },
      { id: "r1", kind: "READING", title: "Valves", body: { type: "doc", content: [{ type: "image", attrs: { src: `/training/files/${inText}` } }, { type: "image", attrs: { src: `/training/files/${elsewhere}` } }] }, videoUrl: "", fileId: null, minutes: 2, data: null },
    ] }],
    questions: [{ id: "q1", sectionId: "s1", kind: "SINGLE", prompt: "Which valve?", imageId: onQuestion, explanation: "",
      options: [{ id: "a", text: "Left", imageId: null, correct: true, match: "", area: null }, { id: "b", text: "Right", imageId: null, correct: false, match: "", area: null }] }],
  };
  const v = (await db.trainingCourseVersion.create({ data: { courseId: filed, number: 1, outline, lessonCount: 2, publishedByName: "maya" } })).id;
  await db.trainingCourse.update({ where: { id: filed }, data: { publishedVersionId: v, coverId: cover } });
  const asg = (await db.trainingAssignment.create({ data: { orgId: ORG, courseId: filed, userId: "ava", assignedByName: "maya", versionId: v, dueOn: new Date("2026-10-20") } })).id;

  for (const id of [lessonFile, inText, onQuestion, cover]) assert.equal((await front.myCourseFile("ava", asg, id))?.id, id);
  assert.equal(await front.myCourseFile("ava", asg, unused), null, "a file not in their version");
  assert.equal(await front.myCourseFile("ava", asg, elsewhere), null, "another course's file, even when the text names it");
  assert.equal(await front.myCourseFile("noah", asg, lessonFile), null, "never someone else's course");

  await db.trainingSubmission.create({ data: { orgId: ORG, assignmentId: asg, userId: "ava", lessonId: "f1", text: "Done", fileName: "my photo.png", mime: "image/png", size: png.length, bytes: png } });
  const work = await front.mySubmissionFile("ava", asg, "f1");
  assert.deepEqual([work?.name, work?.mime, work?.size], ["my photo.png", "image/png", png.length]);
  assert.equal(await front.mySubmissionFile("noah", asg, "f1"), null, "never another person's work");
  assert.equal(await front.mySubmissionFile("ava", asg, "r1"), null, "nothing handed in for that lesson");
  assert.equal(front.MAX_HAND_IN_TEXT, 5000);
  assert.deepEqual(front.HAND_IN_TYPES, ["image/jpeg", "image/png", "image/webp", "application/pdf"]);

  const served = front.trainingFileResponse(work!);
  assert.equal(served.headers.get("Content-Type"), "image/png");
  assert.equal(served.headers.get("Content-Disposition"), "inline; filename*=UTF-8''my%20photo.png");
  assert.equal(served.headers.get("Cache-Control"), "private, no-store");
  assert.equal(served.headers.get("X-Content-Type-Options"), "nosniff");
  assert.match(served.headers.get("Content-Security-Policy")!, /default-src 'none'.*sandbox/);
  assert.deepEqual(new Uint8Array(await served.arrayBuffer()), png);

  // The daily digest: due within three days, or overdue; never for someone who has left.
  const items = async (on: string) => (await front.trainingReminderItems(on)).filter((i) => i.ref === asg);
  assert.deepEqual(await items("2026-10-16"), [], "four days ahead is not yet due");
  assert.deepEqual((await items("2026-10-17")).map((i) => [i.userId, i.kind]), [["ava", "training-due"]]);
  assert.match((await items("2026-10-20"))[0].line, /^Synthetic plant room tour is due /, "due today is not overdue");
  const [late] = await items("2026-10-21");
  assert.equal(late.kind, "training-overdue");
  assert.match(late.line, /is overdue \(it was due .+\)\.$/);
  await db.user.update({ where: { id: "ava" }, data: { isActive: false } });
  assert.deepEqual(await items("2026-10-21"), [], "someone who has left is not reminded");
  await db.user.update({ where: { id: "ava" }, data: { isActive: true } });
  await db.trainingAssignment.update({ where: { id: asg }, data: { status: "COMPLETED", completedAt: new Date() } });
  assert.deepEqual(await items("2026-10-21"), [], "finished training is not reminded");
});
