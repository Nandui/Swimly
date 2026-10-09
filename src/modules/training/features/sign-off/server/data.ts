import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
  const rows = await prisma.trainingAssignment.findMany({
    where: await signoffWhere(who),
    orderBy: { submittedAt: "asc" },
    select: {
      id: true, submittedAt: true, learnerNote: true, dueOn: true,
      course: { select: { title: true, summary: true, grantsType: { select: { name: true } } } },
      user: { select: { id: true, name: true, jobTitle: true } },
    },
  });
  return { who, rows };
}
