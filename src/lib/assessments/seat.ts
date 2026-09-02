import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Every path that takes a place on an assessment session goes through here.
 *  The same mechanism as `withCourseSeat`, and for the same reason: a
 *  re-count inside a transaction does not prevent two front-desk bookings
 *  both reading "19 of 20" and both inserting. Locking the session row
 *  serialises every seat decision for that one session.
 *
 *  Keep the body small: it holds a pool connection, so audit and
 *  revalidation happen after it returns. */
export async function withAssessmentSeat<T>(
  sessionId: string,
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AssessmentSession" WHERE id = ${sessionId} FOR UPDATE`;
      return run(tx);
    },
    { timeout: 10_000 }
  );
}
