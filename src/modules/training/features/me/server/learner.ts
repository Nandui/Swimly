import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { lessonPlace, lessonText, outlineLessons, readOutline } from "@/modules/training/shared/lessons";
import { matchScore, searchWords, snippetOf } from "@/modules/training/shared/learner";
import { effectiveVersionId, mine } from "@/modules/training/features/me/server/course";

/** Search, bookmarks and private notes (e-learning phase 6), for Turnfin Me.
 *  Only ever the signed-in person's own courses. A note is theirs alone: Work
 *  never shows it, and its audit row never carries the words. */

type Person = { id: string; name: string };

/** The person's courses with the version each one plays, read in one go. */
async function myOutlines(userId: string) {
  const rows = await prisma.trainingAssignment.findMany({
    where: { userId, status: { not: "CANCELLED" } }, orderBy: { assignedAt: "desc" },
    select: { id: true, status: true, versionId: true, course: { select: { title: true, summary: true, content: true, category: true, tags: true, publishedVersionId: true } } },
  });
  const ids = [...new Set(rows.map(effectiveVersionId).filter((id): id is string => !!id))];
  const versions = ids.length ? await prisma.trainingCourseVersion.findMany({ where: { id: { in: ids } }, select: { id: true, outline: true } }) : [];
  const outlines = new Map(versions.map((v) => [v.id, readOutline(v.outline)]));
  return rows.map((row) => ({ row, outline: outlines.get(effectiveVersionId(row) ?? "") ?? null }));
}

/** Every course and lesson of theirs that has all the words, best first. */
export async function searchMyTraining(userId: string, q: string) {
  const words = searchWords(q);
  if (!words.length) return { courses: [], lessons: [] };
  const courses: { assignmentId: string; title: string; snippet: string; score: number }[] = [];
  const lessons: { assignmentId: string; lessonId: string; course: string; section: string; title: string; snippet: string; score: number }[] = [];
  for (const { row, outline } of await myOutlines(userId)) {
    const about = [row.course.summary, row.course.category, row.course.tags.join(" "), outline ? "" : row.course.content].join("\n");
    const courseScore = matchScore(words, row.course.title, about);
    if (courseScore) courses.push({ assignmentId: row.id, title: row.course.title, snippet: snippetOf(words, row.course.summary || row.course.content), score: courseScore });
    if (!outline) continue;
    for (const section of outline.sections) {
      for (const lesson of section.lessons) {
        const body = lessonText(lesson);
        const score = matchScore(words, lesson.title, body);
        if (score) lessons.push({ assignmentId: row.id, lessonId: lesson.id, course: row.course.title, section: section.title, title: lesson.title, snippet: snippetOf(words, body), score });
      }
    }
  }
  const best = <T extends { score: number }>(list: T[], take: number) => list.sort((a, b) => b.score - a.score).slice(0, take);
  return { courses: best(courses, 10), lessons: best(lessons, 30) };
}

/** Their bookmark and note on one lesson, for the lesson player. */
export async function myLessonNote(userId: string, assignmentId: string, lessonId: string) {
  const row = await prisma.trainingLessonNote.findUnique({ where: { assignmentId_lessonId: { assignmentId, lessonId } }, select: { userId: true, bookmarked: true, note: true } });
  return row && row.userId === userId ? { bookmarked: row.bookmarked, note: row.note } : { bookmarked: false, note: "" };
}

export const MAX_NOTE = 2000;

/** Saves a bookmark or private note on a lesson of their own course. Clearing both removes it. */
export async function saveLessonNote(me: Person, assignmentId: string, lessonId: string, input: { bookmarked?: boolean; note?: string }): Promise<ActionResult> {
  const found = await mine(prisma, me.id, assignmentId);
  const place = found?.version ? lessonPlace(found.version.outline, lessonId) : null;
  if (!found || !place) return fail("That lesson is not in your course.");
  const note = input.note === undefined ? undefined : input.note.trim().slice(0, MAX_NOTE);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.trainingLessonNote.findUnique({ where: { assignmentId_lessonId: { assignmentId, lessonId } }, select: { id: true, bookmarked: true, note: true } });
    const next = { bookmarked: input.bookmarked ?? existing?.bookmarked ?? false, note: note ?? existing?.note ?? "" };
    if (existing && next.bookmarked === existing.bookmarked && next.note === existing.note) return ok();
    if (!existing && !next.bookmarked && !next.note) return ok();
    if (!next.bookmarked && !next.note) await tx.trainingLessonNote.delete({ where: { id: existing!.id } });
    else await tx.trainingLessonNote.upsert({ where: { assignmentId_lessonId: { assignmentId, lessonId } }, update: next, create: { userId: me.id, assignmentId, lessonId, ...next } });
    const parts = [
      next.bookmarked !== (existing?.bookmarked ?? false) ? (next.bookmarked ? "bookmarked" : "removed the bookmark on") : null,
      next.note !== (existing?.note ?? "") ? (next.note ? (existing?.note ? "changed their note on" : "added a note to") : "removed their note on") : null,
    ].filter(Boolean).join(" and ");
    const what = parts.charAt(0).toUpperCase() + parts.slice(1);
    // The note's words stay private: the audit names the lesson only.
    await logAudit({ actorId: me.id, actorName: me.name, action: "update", entity: "TrainingAssignment", entityId: assignmentId, summary: `${what} the lesson ${place.lesson.title}` }, tx);
    return ok();
  });
}

/** Every lesson they bookmarked or wrote a note on, newest first, with where it sits. */
export async function mySaved(userId: string) {
  const notes = await prisma.trainingLessonNote.findMany({ where: { userId, assignment: { status: { not: "CANCELLED" } } }, orderBy: { updatedAt: "desc" }, take: 200,
    select: { assignmentId: true, lessonId: true, bookmarked: true, note: true, updatedAt: true } });
  if (!notes.length) return [];
  const outlines = new Map((await myOutlines(userId)).map((o) => [o.row.id, o]));
  return notes.flatMap((n) => {
    const found = outlines.get(n.assignmentId);
    const lesson = found?.outline ? outlineLessons(found.outline).find((l) => l.id === n.lessonId) : null;
    const section = lesson ? found!.outline!.sections.find((s) => s.lessons.includes(lesson)) : null;
    return found && lesson ? [{ assignmentId: n.assignmentId, lessonId: n.lessonId, course: found.row.course.title, section: section?.title ?? "", title: lesson.title, bookmarked: n.bookmarked, note: n.note, updatedAt: n.updatedAt }] : [];
  });
}
