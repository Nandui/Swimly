import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { finishAssignment, lessonsLeft } from "@/modules/training/features/me/server/course";

type Person = { id: string; name: string };

/** The learner says they have done it: a practical course then waits for a
 *  trainer's sign-off; anything else is complete, and records any
 *  qualification the course grants (unverified). A course with lessons needs
 *  every lesson finished first, and a final exam passed. */
export async function completeTrainingFor(me: Person, id: string, note: string): Promise<ActionResult> {
  const learnerNote = String(note ?? "").trim().slice(0, 1000);
  return prisma.$transaction(async (tx) => {
    const row = await tx.trainingAssignment.findFirst({ where: { id, userId: me.id }, select: { status: true } });
    if (!row) return fail("That training is not assigned to you.");
    if (row.status !== "ASSIGNED") return fail(row.status === "SUBMITTED" ? "This is already waiting for a trainer to sign it off." : "This training is already finished.");
    const { versionId, left, examNeeded } = await lessonsLeft(tx, me.id, id);
    if (left) return fail(left === 1 ? "Finish the last lesson first." : `Finish the ${left} lessons left first.`);
    if (examNeeded) return fail("Pass the final exam first.");
    if (!(await finishAssignment(tx, me, id, learnerNote, versionId))) return fail("This training has changed. Refresh and try again.");
    return ok();
  });
}
