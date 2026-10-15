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
  const [types, open] = await Promise.all([
    qualificationTypesByIds([row.grantsTypeId]),
    prisma.trainingAssignment.count({ where: { courseId, status: { in: ["ASSIGNED", "SUBMITTED"] } } }),
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
  };
}
export type BuilderCourse = NonNullable<Awaited<ReturnType<typeof courseForBuilder>>>;

/** The draft as the learner would see it, for Preview. */
export async function draftForPreview(courseId: string) {
  const who = await requireTrainingActor();
  const row = await prisma.trainingCourse.findFirst({ where: { id: courseId, orgId: who.orgId ?? undefined }, select: { id: true, title: true, summary: true, requiresSignoff: true, ...DRAFT_SELECT } });
  return row ? { course: { id: row.id, title: row.title, summary: row.summary, requiresSignoff: row.requiresSignoff }, outline: draftOutline(row) } : null;
}
