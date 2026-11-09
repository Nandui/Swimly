import type { Prisma } from "@/generated/prisma/client";
import { mergedAwayMessage } from "@/modules/activities/shared/merges/constants";

/** Call under the course lock, beside `cancellationError`: a class merged away on a date
 *  cannot be started or marked that day; its swimmers are on the class it joined. */
export async function mergedAwayError(tx: Prisma.TransactionClient, courseId: string, date: Date) {
  const merge = await tx.classMerge.findUnique({
    where: { fromCourseId_date: { fromCourseId: courseId, date } },
    select: { intoClassName: true, intoStartMinutes: true },
  });
  return merge ? mergedAwayMessage(merge) : null;
}
