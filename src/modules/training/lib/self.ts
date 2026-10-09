import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addMonthsIso } from "@/modules/training/lib/constants";

/** A person's own training writes, for the staff API (Turnfin Me) only. Work
 *  has no personal actions. The caller has already proved who `me` is. */

type Tx = Prisma.TransactionClient;
type Person = { id: string; name: string };

/** Records the qualification a completed course grants, with the expiry from
 *  the qualification type's validity. Verified by the trainer when there was a
 *  sign-off; unverified (online completion) otherwise. */
export async function grantQualification(tx: Tx, assignmentId: string, verifier: { id: string; name: string } | null, actor: { id: string; name: string }) {
  const row = await tx.trainingAssignment.findUniqueOrThrow({ where: { id: assignmentId }, select: {
    orgId: true, userId: true, user: { select: { name: true } },
    course: { select: { title: true, grantsType: { select: { id: true, name: true, validityMonths: true, archivedAt: true } } } },
  } });
  const type = row.course.grantsType;
  if (!type || type.archivedAt) return;
  const issued = today();
  const expires = type.validityMonths ? addMonthsIso(issued, type.validityMonths) : null;
  const qualification = await tx.qualification.create({ data: {
    orgId: row.orgId, userId: row.userId, typeId: type.id, issuedOn: parseDateOnly(issued), expiresOn: expires ? parseDateOnly(expires) : null,
    note: `Completed ${row.course.title} in Training`, verifiedById: verifier?.id ?? null, verifiedAt: verifier ? new Date() : null,
  } });
  await tx.trainingAssignment.update({ where: { id: assignmentId }, data: { qualificationId: qualification.id } });
  await logAudit({ actorId: actor.id, actorName: actor.name, action: "record-qualification", entity: "Qualification", entityId: qualification.id, summary: `Recorded ${type.name} for ${row.user.name} from ${row.course.title}${expires ? `, valid until ${expires}` : ""}` }, tx);
}

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
