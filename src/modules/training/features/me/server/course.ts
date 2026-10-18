import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { FILE_SELECT } from "@/modules/training/shared/files";
import { grantQualification } from "@/modules/training/shared/grant";
import { docChecks, embedFor, learnerScenario, lessonFiles, lessonMinutes, lessonPlace, outlineLessons, readOutline, videoFor, type Outline } from "@/modules/training/shared/lessons";
import { learnerQuestion, questionFiles, seeded } from "@/modules/training/shared/questions";
import { offlineLabel, offlineTime } from "@/modules/training/features/me/server/offline";
import { submissionFor } from "@/modules/training/features/me/server/hand-in";

/** A learner's course in Turnfin Me (docs/training.md, e-learning phase 1): the
 *  published version they take, their progress through it, and each lesson.
 *  Only ever the signed-in person's own assignment. */

export type Db = Prisma.TransactionClient | typeof prisma;

/** The version this assignment plays. Fixed once they finish a lesson; until
 *  then an open assignment follows the course's latest published version. Done
 *  or submitted training from before lessons stays on the old text (null). */
export const effectiveVersionId = (row: { versionId: string | null; status: string; course: { publishedVersionId: string | null } }) =>
  row.versionId ?? (row.status === "ASSIGNED" ? row.course.publishedVersionId : null);

const ROW = {
  id: true, status: true, versionId: true, examExtraAttempts: true, orgId: true, assignedAt: true,
  course: { select: { id: true, publishedVersionId: true, coverId: true, lessonsInOrder: true, prerequisiteIds: true } }, progress: { select: { lessonId: true } },
} as const satisfies Prisma.TrainingAssignmentSelect;

/** Courses this person still has to complete before this one opens (phase 8), by name. */
async function prerequisitesLeft(db: Db, userId: string, courseIds: readonly string[]) {
  if (!courseIds.length) return [];
  const [courses, done] = await Promise.all([
    db.trainingCourse.findMany({ where: { id: { in: [...courseIds] } }, select: { id: true, title: true } }),
    db.trainingAssignment.findMany({ where: { userId, courseId: { in: [...courseIds] }, status: "COMPLETED" }, distinct: ["courseId"], select: { courseId: true } }),
  ]);
  const finished = new Set(done.map((d) => d.courseId));
  return courses.filter((c) => !finished.has(c.id)).map((c) => ({ id: c.id, title: c.title }));
}

export async function mine(db: Db, userId: string, assignmentId: string) {
  const row = await db.trainingAssignment.findFirst({ where: { id: assignmentId, userId, status: { not: "CANCELLED" } }, select: ROW });
  if (!row) return null;
  const versionId = effectiveVersionId(row);
  const [version, waitingOn] = await Promise.all([
    versionId ? db.trainingCourseVersion.findUnique({ where: { id: versionId }, select: { id: true, outline: true, number: true, changeNote: true } }) : null,
    row.status === "ASSIGNED" ? prerequisitesLeft(db, userId, row.course.prerequisiteIds) : [],
  ]);
  return {
    row, waitingOn, inOrder: row.course.lessonsInOrder,
    version: version && { id: version.id, number: version.number, changeNote: version.changeNote, outline: readOutline(version.outline) }, done: new Set(row.progress.map((p) => p.lessonId)),
  };
}

/** Why a lesson can't be opened yet, or null: courses to finish first, or
 *  (when lessons go in order) the earlier lesson still to do. */
export function lockedBecause(found: { waitingOn: { title: string }[]; inOrder: boolean; done: ReadonlySet<string>; version: { outline: Outline } | null }, lessonId: string) {
  if (found.waitingOn.length) return `Finish ${found.waitingOn.map((c) => `“${c.title}”`).join(" and ")} first.`;
  if (!found.inOrder || !found.version || found.done.has(lessonId)) return null;
  const lessons = outlineLessons(found.version.outline);
  const index = lessons.findIndex((l) => l.id === lessonId);
  const before = lessons.slice(0, Math.max(0, index)).find((l) => !found.done.has(l.id));
  return before ? `This course goes in order. Finish “${before.title}” first.` : null;
}

/** Where someone is in a course: lessons done, the total, and the lesson to continue with. */
export function progressOf(outline: Outline, done: ReadonlySet<string>) {
  const lessons = outlineLessons(outline);
  const finished = lessons.filter((l) => done.has(l.id)).length;
  return { done: finished, total: lessons.length, nextLessonId: lessons.find((l) => !done.has(l.id))?.id ?? null };
}

/** Progress for many assignments at once, for the training list and home. */
export async function progressFor(rows: { id: string; versionId: string | null; status: string; course: { publishedVersionId: string | null } }[]) {
  const ids = [...new Set(rows.map(effectiveVersionId).filter((id): id is string => !!id))];
  if (!ids.length) return new Map<string, ReturnType<typeof progressOf>>();
  const [versions, progress] = await Promise.all([
    prisma.trainingCourseVersion.findMany({ where: { id: { in: ids } }, select: { id: true, outline: true } }),
    prisma.trainingLessonProgress.findMany({ where: { assignmentId: { in: rows.map((r) => r.id) } }, select: { assignmentId: true, lessonId: true } }),
  ]);
  const outlines = new Map(versions.map((v) => [v.id, readOutline(v.outline)]));
  const out = new Map<string, ReturnType<typeof progressOf>>();
  for (const row of rows) {
    const outline = outlines.get(effectiveVersionId(row) ?? "");
    if (outline) out.set(row.id, progressOf(outline, new Set(progress.filter((p) => p.assignmentId === row.id).map((p) => p.lessonId))));
  }
  return out;
}

/** The course outline with each lesson's state. Null for training without lessons. */
export async function myCourse(userId: string, assignmentId: string) {
  const found = await mine(prisma, userId, assignmentId);
  if (!found?.version) return null;
  const { version, done } = found;
  const open = found.row.status === "ASSIGNED";
  return {
    // Courses to finish first, and whether lessons go in order (phase 8).
    waitingOn: open ? found.waitingOn : [], inOrder: found.inOrder,
    // What changed in this version, in its author's words, from version 2 on.
    whatsNew: version.number > 1 && version.changeNote ? { number: version.number, note: version.changeNote } : null,
    sections: version.outline.sections.map((s) => ({
      id: s.id, title: s.title,
      lessons: s.lessons.map((l) => ({ id: l.id, kind: l.kind, title: l.title, minutes: lessonMinutes(l), done: done.has(l.id), locked: open && !!lockedBecause(found, l.id) })),
    })),
    ...progressOf(version.outline, done),
  };
}

/** A Quiz lesson's questions, without the key, shuffled the same way each time for this learner. */
function quizQuestions(outline: Outline, sectionId: string, seed: string) {
  const random = seeded(seed);
  return outline.questions.filter((q) => q.sectionId === sectionId).map((q) => learnerQuestion(q, random));
}

/** One lesson to play, with the lessons either side. */
export async function myLesson(userId: string, assignmentId: string, lessonId: string) {
  const found = await mine(prisma, userId, assignmentId);
  const place = found?.version ? lessonPlace(found.version.outline, lessonId) : null;
  if (!found || !place) return null;
  const { lesson } = place;
  const file = (lesson.kind === "FILE" || lesson.kind === "AUDIO" || lesson.kind === "EXPLORE") && lesson.fileId
    ? await prisma.trainingFile.findFirst({ where: { id: lesson.fileId, courseId: found.row.course.id }, select: { id: true, name: true, mime: true, size: true } })
    : null;
  const video = lesson.kind === "VIDEO" ? videoFor(lesson.videoUrl) : null;
  const outline = found.version!.outline;
  // Knowledge checks in the text: the questions without their key, in the order they appear.
  const checkIds = docChecks(lesson.body);
  const random = seeded(`${assignmentId}:${lesson.id}:checks`);
  const checks = outline.questions.filter((q) => checkIds.includes(q.id)).map((q) => learnerQuestion(q, random));
  return {
    id: lesson.id, kind: lesson.kind, title: lesson.title, body: lesson.body, minutes: lessonMinutes(lesson), checks,
    steps: lesson.kind === "SCENARIO" ? learnerScenario(lesson.data?.steps ?? []) : null,
    cards: lesson.kind === "FLASHCARDS" ? lesson.data?.cards ?? [] : null,
    items: lesson.kind === "CHECKLIST" ? lesson.data?.items ?? [] : null,
    // Phase 8: groups and things to sort (practice, so sent whole), spots on a picture, slides, and work to hand in.
    sorting: lesson.kind === "SORTING" ? { groups: lesson.data?.groups ?? [], sorts: lesson.data?.sorts ?? [] } : null,
    spots: lesson.kind === "EXPLORE" ? lesson.data?.spots ?? [] : null,
    embed: lesson.kind === "EMBED" ? embedFor(lesson.videoUrl) : null,
    handIn: lesson.kind === "ASSIGNMENT" ? { settings: lesson.data?.handIn ?? null, submission: await submissionFor(prisma, assignmentId, lesson.id) } : null,
    locked: found.row.status === "ASSIGNED" ? lockedBecause(found, lesson.id) : null,
    video: video && { embed: video.embed, href: video.href, provider: video.provider }, file,
    questions: lesson.kind === "QUIZ" ? quizQuestions(found.version!.outline, place.section.id, `${assignmentId}:${lesson.id}`) : null,
    section: place.section.title, index: place.index, total: place.total, prev: place.prev, next: place.next,
    done: found.done.has(lesson.id), open: found.row.status === "ASSIGNED",
  };
}

/** The learner finished a lesson. The first one fixes the version they take. */
/** `at`: when it was finished on the phone with no signal (phase 9), if believable. */
export async function completeLessonFor(me: { id: string; name: string }, assignmentId: string, lessonId: string, at: string | null = null): Promise<ActionResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    if (!found) return fail("That training is not assigned to you.");
    if (found.row.status !== "ASSIGNED") return fail(found.row.status === "SUBMITTED" ? "This is already waiting for a trainer to sign it off." : "This training is already finished.");
    const place = found.version ? lessonPlace(found.version.outline, lessonId) : null;
    if (!found.version || !place) return fail("That lesson is not in your course.");
    if (found.done.has(lessonId)) return ok();
    const locked = lockedBecause(found, lessonId);
    if (locked) return fail(locked);
    if (place.lesson.kind === "ASSIGNMENT") {
      const sent = await submissionFor(tx, assignmentId, lessonId);
      if (!sent) return fail("Hand in your work first.");
      if (sent.status !== "ACCEPTED") return fail(sent.status === "RETURNED" ? "Your trainer sent this back. Change it and hand it in again." : "A trainer checks this first. The lesson is done once they accept it.");
    }
    if (!found.row.versionId) await tx.trainingAssignment.update({ where: { id: assignmentId }, data: { versionId: found.version.id } });
    const offline = offlineTime(at, found.row.assignedAt);
    await tx.trainingLessonProgress.create({ data: { assignmentId, lessonId, ...(offline ? { completedAt: offline } : {}) } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "TrainingAssignment", entityId: assignmentId,
      summary: `Finished lesson ${place.index + 1} of ${place.total}, ${place.lesson.title}${offline ? `, offline at ${offlineLabel(offline)}` : ""}` }, tx);
    return ok();
  });
}

/** What still stops the learner finishing: lessons not done yet, and a final
 *  exam not passed. Passing an exam that allows testing out skips the lessons. */
export async function lessonsLeft(tx: Db, userId: string, assignmentId: string) {
  const found = await mine(tx, userId, assignmentId);
  if (!found?.version) return { versionId: null, left: 0, examNeeded: false };
  const { outline } = found.version;
  const hasExam = !!outline.exam && outline.questions.length > 0;
  const passed = hasExam && !!(await tx.trainingExamAttempt.findFirst({ where: { assignmentId, passed: true }, select: { id: true } }));
  const left = passed && outline.exam!.testOut ? 0 : outlineLessons(outline).filter((l) => !found.done.has(l.id)).length;
  return { versionId: found.version.id, left, examNeeded: hasExam && !passed };
}

/** Moves the learner's assignment on once everything is done: to a trainer
 *  for sign-off on a practical course, otherwise complete, recording any
 *  qualification it grants (unverified). */
export async function finishAssignment(tx: Prisma.TransactionClient, me: { id: string; name: string }, id: string, learnerNote: string, versionId: string | null) {
  const row = await tx.trainingAssignment.findFirst({ where: { id, userId: me.id }, select: { course: { select: { title: true, requiresSignoff: true } } } });
  if (!row) return false;
  const next = row.course.requiresSignoff ? "SUBMITTED" as const : "COMPLETED" as const;
  const now = new Date();
  const moved = await tx.trainingAssignment.updateMany({ where: { id, userId: me.id, status: "ASSIGNED" }, data: next === "SUBMITTED"
    ? { status: next, submittedAt: now, learnerNote, versionId }
    : { status: next, submittedAt: now, completedAt: now, learnerNote, versionId } });
  if (moved.count !== 1) return false;
  await logAudit({ actorId: me.id, actorName: me.name, action: next === "SUBMITTED" ? "submit" : "complete", entity: "TrainingAssignment", entityId: id,
    summary: next === "SUBMITTED" ? `Asked for sign-off on ${row.course.title}` : `Completed ${row.course.title}` }, tx);
  if (next === "COMPLETED") await grantQualification(tx, id, null, me);
  return true;
}

/** A file used in the learner's own course version: a File lesson, an image in
 *  the text, or a picture on a question or answer. */
export async function myCourseFile(userId: string, assignmentId: string, fileId: string) {
  const found = await mine(prisma, userId, assignmentId);
  if (!found?.version) return null;
  const { outline } = found.version;
  // The course's cover is live, not part of a version, so the current one counts too.
  const used = found.row.course.coverId === fileId || outlineLessons(outline).some((l) => lessonFiles(l).includes(fileId))
    || outline.questions.some((q) => questionFiles(q).includes(fileId));
  if (!used) return null;
  return prisma.trainingFile.findFirst({ where: { id: fileId, courseId: found.row.course.id }, select: FILE_SELECT });
}
