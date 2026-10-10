import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { grantQualification } from "@/modules/training/shared/grant";

type Person = { id: string; name: string };

/** The learner says they have done it: a practical course then waits for a
 *  trainer's sign-off; anything else is complete, and records any
 *  qualification the course grants (unverified). */
export async function completeTrainingFor(me: Person, id: string, note: string): Promise<ActionResult> {
  const learnerNote = String(note ?? "").trim().slice(0, 1000);
  return prisma.$transaction(async (tx) => {
    const row = await tx.trainingAssignment.findFirst({ where: { id, userId: me.id }, select: { status: true, course: { select: { title: true, requiresSignoff: true } } } });
    if (!row) return fail("That training is not assigned to you.");
    if (row.status !== "ASSIGNED") return fail(row.status === "SUBMITTED" ? "This is already waiting for a trainer to sign it off." : "This training is already finished.");
    const next = row.course.requiresSignoff ? "SUBMITTED" as const : "COMPLETED" as const;
    const now = new Date();
    const moved = await tx.trainingAssignment.updateMany({ where: { id, userId: me.id, status: "ASSIGNED" }, data: next === "SUBMITTED"
      ? { status: next, submittedAt: now, learnerNote }
      : { status: next, submittedAt: now, completedAt: now, learnerNote } });
    if (moved.count !== 1) return fail("This training has changed. Refresh and try again.");
    await logAudit({ actorId: me.id, actorName: me.name, action: next === "SUBMITTED" ? "submit" : "complete", entity: "TrainingAssignment", entityId: id,
      summary: next === "SUBMITTED" ? `Asked for sign-off on ${row.course.title}` : `Completed ${row.course.title}` }, tx);
    if (next === "COMPLETED") await grantQualification(tx, id, null, me);
    return ok();
  });
}
