import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { frozenOutline, readOutline } from "@/modules/training/shared/lessons";
import { readObservation } from "@/modules/training/shared/on-the-job";
import { DRAFT_SELECT, draftOutline } from "@/modules/training/features/builder/server/draft";

/** One course for the builder: its settings, the draft outline, the files it
 *  uses and its published versions. Any Training user may open it read-only;
 *  changing it needs the Author level (`training.manage`). */
export async function courseForBuilder(courseId: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingCourse.findFirst({
    where: { id: courseId, orgId: who.orgId ?? undefined },
    select: {
      id: true, title: true, summary: true, content: true, requiresSignoff: true, grantsTypeId: true, archivedAt: true, publishedVersionId: true,
      coverId: true, category: true, tags: true, observation: true, selfEnrol: true,
      ...DRAFT_SELECT,
      comments: { orderBy: { createdAt: "asc" }, take: 300, select: { id: true, lessonId: true, body: true, authorName: true, createdAt: true, resolvedAt: true, resolvedByName: true } },
      files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true } },
      versions: { orderBy: { number: "desc" }, take: 5, select: { id: true, number: true, publishedAt: true, publishedByName: true, lessonCount: true, outline: true, changeNote: true, retake: true } },
    },
  });
  if (!row) return null;
  const draft = draftOutline(row);
  const published = row.versions.find((v) => v.id === row.publishedVersionId) ?? null;
  // The draft differs from what learners get when its outline would freeze differently.
  const changed = !published || JSON.stringify(readOutline(published.outline)) !== JSON.stringify(frozenOutline(draft));
  const [types, open, report, finished, courses, feedback] = await Promise.all([
    qualificationTypesByIds([row.grantsTypeId]),
    prisma.trainingAssignment.count({ where: { courseId, status: { in: ["ASSIGNED", "SUBMITTED"] } } }),
    examReport(courseId),
    prisma.trainingAssignment.findMany({ where: { courseId, status: "COMPLETED" }, distinct: ["userId"], select: { userId: true } }),
    prisma.trainingCourse.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
    feedbackReport(courseId, row.versions),
  ]);
  const grants = row.grantsTypeId ? types.get(row.grantsTypeId) : undefined;
  return {
    who,
    course: {
      id: row.id, title: row.title, summary: row.summary, content: row.content, requiresSignoff: row.requiresSignoff, archivedAt: row.archivedAt,
      coverId: row.coverId, category: row.category, tags: row.tags, selfEnrol: row.selfEnrol,
      grantsType: grants ? { id: grants.id, name: grants.name, validityMonths: grants.validityMonths } : null,
    },
    draft,
    practical: readObservation(row.observation),
    files: row.files,
    published: published && { number: published.number, publishedAt: published.publishedAt, publishedByName: published.publishedByName, lessonCount: published.lessonCount },
    versions: row.versions.map((v) => ({ id: v.id, number: v.number, publishedAt: v.publishedAt, publishedByName: v.publishedByName, lessonCount: v.lessonCount, changeNote: v.changeNote, retake: v.retake })),
    // Open comments, and those dealt with in the last 30 days.
    comments: row.comments.filter((c) => !c.resolvedAt || c.resolvedAt.getTime() > Date.now() - 30 * 86_400_000),
    categories: await courseCategories(who.orgId),
    changed,
    openAssignments: open,
    finished: finished.length,
    courses,
    report,
    feedback,
  };
}

/** How the final exam has gone, across every published version: sittings,
 *  passes, and for each question how often it was asked and missed. Question
 *  ids carry from the draft into every version, so the counts follow a
 *  question through re-publishing. The latest 2,000 sittings at most. */
async function examReport(courseId: string) {
  const versions = await prisma.trainingCourseVersion.findMany({ where: { courseId }, select: { id: true } });
  if (!versions.length) return { sittings: 0, passed: 0, questions: {} as Record<string, { asked: number; missed: number }> };
  const attempts = await prisma.trainingExamAttempt.findMany({
    where: { versionId: { in: versions.map((v) => v.id) }, submittedAt: { not: null } },
    orderBy: { submittedAt: "desc" }, take: 2000, select: { passed: true, results: true },
  });
  const questions: Record<string, { asked: number; missed: number }> = {};
  for (const attempt of attempts) {
    for (const [id, right] of Object.entries((attempt.results ?? {}) as Record<string, boolean>)) {
      const entry = (questions[id] ??= { asked: 0, missed: 0 });
      entry.asked += 1;
      if (!right) entry.missed += 1;
    }
  }
  return { sittings: attempts.length, passed: attempts.filter((a) => a.passed).length, questions };
}
/** What learners said once they finished (phase 6): the average rating, how
 *  many gave each, and what was unclear, newest first. Never who said it. */
async function feedbackReport(courseId: string, versions: { id: string; number: number }[]) {
  const rows = await prisma.trainingFeedback.findMany({ where: { courseId }, orderBy: { updatedAt: "desc" }, take: 500, select: { rating: true, unclear: true, updatedAt: true, versionId: true } });
  const number = new Map(versions.map((v) => [v.id, v.number]));
  const stars = [5, 4, 3, 2, 1].map((n) => ({ stars: n, count: rows.filter((r) => r.rating === n).length }));
  return {
    count: rows.length,
    average: rows.length ? Math.round((rows.reduce((n, r) => n + r.rating, 0) / rows.length) * 10) / 10 : null,
    stars,
    comments: rows.filter((r) => r.unclear).slice(0, 50).map((r) => ({ rating: r.rating, unclear: r.unclear, on: r.updatedAt, version: r.versionId ? number.get(r.versionId) ?? null : null })),
  };
}
export type FeedbackReport = Awaited<ReturnType<typeof feedbackReport>>;

export type BuilderCourse = NonNullable<Awaited<ReturnType<typeof courseForBuilder>>>;

/** Categories already in use, to offer when setting a course's. */
export async function courseCategories(orgId: string | null) {
  const rows = await prisma.trainingCourse.findMany({ where: { orgId: orgId ?? undefined, category: { not: "" } }, distinct: ["category"], select: { category: true }, orderBy: { category: "asc" } });
  return rows.map((r) => r.category);
}

/** The draft as the learner would see it, for Preview. */
export async function draftForPreview(courseId: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId ?? undefined }, select: { id: true, title: true, summary: true, requiresSignoff: true, ...DRAFT_SELECT } });
  return row ? { course: { id: row.id, title: row.title, summary: row.summary, requiresSignoff: row.requiresSignoff }, outline: draftOutline(row) } : null;
}
