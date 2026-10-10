import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/** Every path that can occupy a place in a class goes through here, and
 *  nothing else creates an ACTIVE enrolment — not the actions, not an import
 *  script.
 *
 *  The row lock is the whole mechanism. An interactive transaction that merely
 *  re-counts does **not** fix the race: at READ COMMITTED two transactions both
 *  read 11 and both insert. Locking the course row serialises every seat
 *  decision for that one class, which also makes the "already enrolled here?"
 *  check race-free — which is why there is no unique constraint on
 *  (studentId, courseId), and why repeating a level is possible at all.
 *
 *  Keep the body small. Write the audit through the transaction so it commits
 *  with the enrolment; revalidation happens after the transaction returns.
 *
 *  It lives here rather than in the actions file because that file is
 *  `"use server"`, where every export becomes a POST endpoint — and a helper
 *  taking a callback could not be one. Importing it from both the actions and
 *  the import scripts is what keeps a single locking path. */
export async function withCourseSeat<T>(
  courseId: string | readonly string[],
  run: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      // Transfers lock both classes in a stable order to avoid deadlocks.
      const courseIds = [...new Set(typeof courseId === "string" ? [courseId] : courseId)].sort();
      for (const id of courseIds) {
        await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${id} FOR UPDATE`;
      }
      return run(tx);
    },
    { timeout: 10_000 }
  );
}
