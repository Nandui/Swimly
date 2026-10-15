import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { FILE_SELECT } from "@/modules/training/shared/files";
import { docImages, lessonMinutes, lessonPlace, outlineLessons, readOutline, videoFor, type Outline } from "@/modules/training/shared/lessons";

/** A learner's course in Turnfin Me (docs/training.md, e-learning phase 1): the
 *  published version they take, their progress through it, and each lesson.
 *  Only ever the signed-in person's own assignment. */

type Db = Prisma.TransactionClient | typeof prisma;

/** The version this assignment plays. Fixed once they finish a lesson; until
 *  then an open assignment follows the course's latest published version. Done
 *  or submitted training from before lessons stays on the old text (null). */
export const effectiveVersionId = (row: { versionId: string | null; status: string; course: { publishedVersionId: string | null } }) =>
  row.versionId ?? (row.status === "ASSIGNED" ? row.course.publishedVersionId : null);

const ROW = { id: true, status: true, versionId: true, course: { select: { id: true, publishedVersionId: true } }, progress: { select: { lessonId: true } } } as const satisfies Prisma.TrainingAssignmentSelect;

async function mine(db: Db, userId: string, assignmentId: string) {
  const row = await db.trainingAssignment.findFirst({ where: { id: assignmentId, userId, status: { not: "CANCELLED" } }, select: ROW });
  if (!row) return null;
  const versionId = effectiveVersionId(row);
  const version = versionId ? await db.trainingCourseVersion.findUnique({ where: { id: versionId }, select: { id: true, outline: true } }) : null;
  return { row, version: version && { id: version.id, outline: readOutline(version.outline) }, done: new Set(row.progress.map((p) => p.lessonId)) };
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
  return {
    sections: version.outline.sections.map((s) => ({
      id: s.id, title: s.title,
      lessons: s.lessons.map((l) => ({ id: l.id, kind: l.kind, title: l.title, minutes: lessonMinutes(l), done: done.has(l.id) })),
    })),
    ...progressOf(version.outline, done),
  };
}

/** One lesson to play, with the lessons either side. */
export async function myLesson(userId: string, assignmentId: string, lessonId: string) {
  const found = await mine(prisma, userId, assignmentId);
  const place = found?.version ? lessonPlace(found.version.outline, lessonId) : null;
  if (!found || !place) return null;
  const { lesson } = place;
  const file = lesson.kind === "FILE" && lesson.fileId
    ? await prisma.trainingFile.findFirst({ where: { id: lesson.fileId, courseId: found.row.course.id }, select: { id: true, name: true, mime: true, size: true } })
    : null;
  const video = lesson.kind === "VIDEO" ? videoFor(lesson.videoUrl) : null;
  return {
    id: lesson.id, kind: lesson.kind, title: lesson.title, body: lesson.body, minutes: lessonMinutes(lesson),
    video: video && { embed: video.embed, href: video.href, provider: video.provider }, file,
    section: place.section.title, index: place.index, total: place.total, prev: place.prev, next: place.next,
    done: found.done.has(lesson.id), open: found.row.status === "ASSIGNED",
  };
}

/** The learner finished a lesson. The first one fixes the version they take. */
export async function completeLessonFor(me: { id: string; name: string }, assignmentId: string, lessonId: string): Promise<ActionResult> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "TrainingAssignment" WHERE id = ${assignmentId} AND "userId" = ${me.id} FOR UPDATE`;
    const found = await mine(tx, me.id, assignmentId);
    if (!found) return fail("That training is not assigned to you.");
    if (found.row.status !== "ASSIGNED") return fail(found.row.status === "SUBMITTED" ? "This is already waiting for a trainer to sign it off." : "This training is already finished.");
    const place = found.version ? lessonPlace(found.version.outline, lessonId) : null;
    if (!found.version || !place) return fail("That lesson is not in your course.");
    if (found.done.has(lessonId)) return ok();
    if (!found.row.versionId) await tx.trainingAssignment.update({ where: { id: assignmentId }, data: { versionId: found.version.id } });
    await tx.trainingLessonProgress.create({ data: { assignmentId, lessonId } });
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "TrainingAssignment", entityId: assignmentId,
      summary: `Finished lesson ${place.index + 1} of ${place.total}, ${place.lesson.title}` }, tx);
    return ok();
  });
}

/** What still stops the learner finishing: lessons not done yet. */
export async function lessonsLeft(tx: Db, userId: string, assignmentId: string) {
  const found = await mine(tx, userId, assignmentId);
  if (!found?.version) return { versionId: null, left: 0 };
  return { versionId: found.version.id, left: outlineLessons(found.version.outline).filter((l) => !found.done.has(l.id)).length };
}

/** A file used in the learner's own course version: a File lesson or an image in the text. */
export async function myCourseFile(userId: string, assignmentId: string, fileId: string) {
  const found = await mine(prisma, userId, assignmentId);
  if (!found?.version) return null;
  const used = outlineLessons(found.version.outline).some((l) => l.fileId === fileId || docImages(l.body).includes(fileId));
  if (!used) return null;
  return prisma.trainingFile.findFirst({ where: { id: fileId, courseId: found.row.course.id }, select: FILE_SELECT });
}
