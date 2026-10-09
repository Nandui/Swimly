import "server-only";
import { prisma } from "@/lib/prisma";
import { requireTrainingActor } from "@/modules/training/shared/access";

export async function listQualificationTypeOptions() {
  const who = await requireTrainingActor();
  return prisma.qualificationType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, validityMonths: true } });
}
