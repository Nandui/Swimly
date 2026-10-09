import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { parseDateOnly, today } from "@/lib/format";
import { addMonthsIso } from "@/modules/training/shared/constants";

/** A person's own training writes, for the staff API (Turnfin Me) only. Work
 *  has no personal actions. The caller has already proved who `me` is. */

export type Tx = Prisma.TransactionClient;

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
