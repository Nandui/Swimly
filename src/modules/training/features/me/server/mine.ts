import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { trainingState, type TrainingState } from "@/modules/training/shared/constants";

/** Self-service reads: the signed-in person's own training. No capability is
 *  needed and nothing here can reach another person's records. Kept apart
 *  from the Manage reads so the staff API loads without the policy engine. */

const MY_SELECT = {
  id: true, status: true, dueOn: true, assignedAt: true, assignedByName: true, submittedAt: true, completedAt: true,
  learnerNote: true, signoffNote: true, signedOffByName: true,
  course: { select: { title: true, summary: true, content: true, requiresSignoff: true, grantsType: { select: { name: true } } } },
} as const satisfies Prisma.TrainingAssignmentSelect;

export async function myTraining(userId: string) {
  const on = today();
  const rows = await prisma.trainingAssignment.findMany({
    where: { userId, status: { not: "CANCELLED" } },
    orderBy: [{ dueOn: { sort: "asc", nulls: "last" } }, { assignedAt: "desc" }],
    select: MY_SELECT,
  });
  return rows.map((row) => ({ ...row, state: trainingState(row, on) as TrainingState }));
}

export async function myAssignment(id: string) {
  const session = await requireSession();
  const row = await prisma.trainingAssignment.findFirst({ where: { id, userId: session.user.id }, select: MY_SELECT });
  if (!row) notFound();
  return { ...row, state: trainingState(row, today()) };
}
