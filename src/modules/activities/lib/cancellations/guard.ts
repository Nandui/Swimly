import type { Prisma } from "@/generated/prisma/client";
import { CANCELLED_SESSION_ERROR } from "./constants";

/** Call under the course lock, shared with cancellation and class starts. */
export async function cancellationError(tx: Prisma.TransactionClient, courseId: string, date: Date) {
  const cancelled = await tx.classCancellation.findUnique({
    where: { courseId_date: { courseId, date } }, select: { id: true },
  });
  return cancelled ? CANCELLED_SESSION_ERROR : null;
}
