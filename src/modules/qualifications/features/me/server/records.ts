import "server-only";
import { prisma } from "@/lib/prisma";
import { hoursOf } from "@/modules/qualifications/shared/hours-reads";

/** A person's own in-service hours, for Turnfin Me through the staff API: progress against each
 *  target they hold, and their log. Only ever the signed-in person's own; the caller has proved
 *  who they are. */
export async function myHours(userId: string, orgId: string | null) {
  return hoursOf(userId, orgId);
}

/** Every in-service hours entry this person has, removed ones too, for HR's subject export. */
export async function hoursRecords(userId: string) {
  return prisma.trainingHours.findMany({ where: { userId }, orderBy: { on: "asc" }, select: { on: true, minutes: true, topic: true, typeId: true, recordedByName: true, removedAt: true, removedByName: true } });
}
