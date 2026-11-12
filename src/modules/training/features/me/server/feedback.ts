import "server-only";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/** A learner's rating of a course they finished, and what was unclear
 *  (e-learning phase 6). One per assignment, changeable. Authors see the
 *  average and the comments without names. */

export async function myFeedback(userId: string, assignmentId: string) {
  const row = await prisma.trainingFeedback.findUnique({ where: { assignmentId }, select: { userId: true, rating: true, unclear: true } });
  return row && row.userId === userId ? { rating: row.rating, unclear: row.unclear } : null;
}

export async function rateCourse(me: { id: string; name: string }, assignmentId: string, input: { rating: number; unclear: string }): Promise<ActionResult> {
  const rating = Math.round(input.rating);
  if (!(rating >= 1 && rating <= 5)) return fail("Choose from one to five stars.");
  const unclear = input.unclear.trim().slice(0, 1000);
  return prisma.$transaction(async (tx) => {
    const row = await tx.trainingAssignment.findFirst({ where: { id: assignmentId, userId: me.id }, select: { orgId: true, courseId: true, status: true, versionId: true, course: { select: { title: true } } } });
    if (!row) return fail("That training is not assigned to you.");
    if (row.status !== "COMPLETED" && row.status !== "SUBMITTED") return fail("You can rate a course once you have finished it.");
    const existing = await tx.trainingFeedback.findUnique({ where: { assignmentId }, select: { id: true } });
    await tx.trainingFeedback.upsert({ where: { assignmentId }, update: { rating, unclear },
      create: { orgId: row.orgId, assignmentId, userId: me.id, courseId: row.courseId, versionId: row.versionId, rating, unclear } });
    await logAudit({ actorId: me.id, actorName: me.name, action: existing ? "update" : "create", entity: "TrainingAssignment", entityId: assignmentId,
      summary: `${existing ? "Changed their rating of" : "Rated"} ${row.course.title}: ${rating} of 5${unclear ? ", with a note on what was unclear" : ""}` }, tx);
    return ok();
  });
}
