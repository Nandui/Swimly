import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { staffCardsByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { qualificationTypesByIds } from "@/lib/qualifications";
import { requireTrainingActor } from "@/modules/training/shared/access";
import { scopedUserIds } from "@/modules/training/shared/data";

// ---------------------------------------------------------------------------
// Sign-off queue
// ---------------------------------------------------------------------------

/** Submitted practical work this person may sign off: people in their reach, never themselves. */
async function signoffWhere(who: { id: string; orgId: string | null }): Promise<Prisma.TrainingAssignmentWhereInput> {
  return { orgId: who.orgId ?? undefined, status: "SUBMITTED", userId: { ...(await scopedUserIds("training.signoff")), not: who.id } };
}

/** How many wait for this person's sign-off, for the home page: a count, no names. */
export async function signoffCount() {
  const who = await requireTrainingActor();
  if (!who.signoff) return 0;
  return prisma.trainingAssignment.count({ where: await signoffWhere(who) });
}

export async function signoffQueue() {
  const who = await requireTrainingActor();
  if (!who.signoff) return { who, rows: [] };
  const found = await prisma.trainingAssignment.findMany({
    where: await signoffWhere(who),
    orderBy: { submittedAt: "asc" },
    select: {
      id: true, submittedAt: true, learnerNote: true, dueOn: true,
      course: { select: { title: true, summary: true, grantsTypeId: true } }, userId: true,
    },
  });
  const [people, types] = await Promise.all([staffCardsByIds(found.map((r) => r.userId)), qualificationTypesByIds(found.map((r) => r.course.grantsTypeId))]);
  const rows = found.map(({ userId, course: { grantsTypeId, ...course }, ...row }) => ({
    ...row,
    course: { ...course, grantsType: grantsTypeId && types.has(grantsTypeId) ? { name: types.get(grantsTypeId)!.name } : null },
    user: people.get(userId) ?? { id: userId, name: "Former staff", jobTitle: null },
  }));
  return { who, rows };
}
