import "server-only";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { readOutline } from "@/modules/training/shared/lessons";
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
      ...DRAFT_SELECT,
      files: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, mime: true, size: true } },
      versions: { orderBy: { number: "desc" }, take: 5, select: { id: true, number: true, publishedAt: true, publishedByName: true, lessonCount: true, outline: true } },
    },
  });
  if (!row) return null;
  const draft = draftOutline(row);
  const published = row.versions.find((v) => v.id === row.publishedVersionId) ?? null;
  // The draft differs from what learners get when its outline would freeze differently.
  const changed = !published || JSON.stringify(readOutline(published.outline)) !== JSON.stringify(draft);
  const [types, open, report] = await Promise.all([
    qualificationTypesByIds([row.grantsTypeId]),
    prisma.trainingAssignment.count({ where: { courseId, status: { in: ["ASSIGNED", "SUBMITTED"] } } }),
    examReport(courseId),
  ]);
  const grants = row.grantsTypeId ? types.get(row.grantsTypeId) : undefined;
  return {
    who,
    course: {
      id: row.id, title: row.title, summary: row.summary, content: row.content, requiresSignoff: row.requiresSignoff, archivedAt: row.archivedAt,
      grantsType: grants ? { id: grants.id, name: grants.name, validityMonths: grants.validityMonths } : null,
    },
    draft,
    files: row.files,
    published: published && { number: published.number, publishedAt: published.publishedAt, publishedByName: published.publishedByName, lessonCount: published.lessonCount },
    versions: row.versions.map((v) => ({ id: v.id, number: v.number, publishedAt: v.publishedAt, publishedByName: v.publishedByName, lessonCount: v.lessonCount })),
    changed,
    openAssignments: open,
    report,
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
export type BuilderCourse = NonNullable<Awaited<ReturnType<typeof courseForBuilder>>>;

/** The draft as the learner would see it, for Preview. */
export async function draftForPreview(courseId: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId ?? undefined }, select: { id: true, title: true, summary: true, requiresSignoff: true, ...DRAFT_SELECT } });
  return row ? { course: { id: row.id, title: row.title, summary: row.summary, requiresSignoff: row.requiresSignoff }, outline: draftOutline(row) } : null;
}
