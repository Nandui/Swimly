import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { trainingState, type TrainingState } from "@/modules/training/shared/constants";
import { progressFor } from "@/modules/training/features/me/server/course";

/** Self-service reads: the signed-in person's own training. No capability is
 *  needed and nothing here can reach another person's records. Kept apart
 *  from the Manage reads so the staff API loads without the policy engine. */

const MY_SELECT = {
  id: true, status: true, versionId: true, dueOn: true, assignedAt: true, assignedByName: true, submittedAt: true, completedAt: true,
  learnerNote: true, signoffNote: true, signedOffByName: true,
  course: { select: { title: true, summary: true, content: true, requiresSignoff: true, grantsTypeId: true, publishedVersionId: true, coverId: true, category: true } },
} as const satisfies Prisma.TrainingAssignmentSelect;

/** Each course's qualification, by name, from Core. */
async function withGrants<C extends { grantsTypeId: string | null }, T extends { course: C }>(rows: T[]) {
  const types = await qualificationTypesByIds(rows.map((row) => row.course.grantsTypeId));
  return rows.map((row) => {
    const { grantsTypeId, ...course } = row.course;
    const type = grantsTypeId ? types.get(grantsTypeId) : undefined;
    return { ...row, course: { ...(course as Omit<C, "grantsTypeId">), grantsType: type ? { name: type.name } : null } };
  });
}

export async function myTraining(userId: string) {
  const on = today();
  const rows = await prisma.trainingAssignment.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { assignedAt: "desc" }],
    select: MY_SELECT,
  });
  const progress = await progressFor(rows);
  // `progress` is null for training without lessons: the old text, marked done in one go.
  return (await withGrants(rows)).map((row) => ({ ...row, state: trainingState(row, on) as TrainingState, progress: progress.get(row.id) ?? null }));
}

