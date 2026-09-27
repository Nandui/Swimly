"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { CHANGEABLE_FIELDS, CHANGE_FIELD_LABELS, type ChangeableField } from "@/lib/parent/change-requests";

/** Reception applies or declines a parent's proposed correction. Applying
 *  writes only the proposed fields to the swimmer, in the same transaction as
 *  the audit row (which names the fields, never medical text); the reply goes
 *  back to the parent. A request is decided once. */

const reviewer = (session: { user: { id: string; name?: string | null } }) => ({ id: session.user.id, name: session.user.name ?? "Reception" });
const cleanReply = (reply: unknown) => String(reply ?? "").trim().slice(0, 500);

export async function applyParentChange(id: string, reply: string): Promise<ActionResult> {
  const session = await requirePermission("students.manage");
  const who = reviewer(session);
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.parentChangeRequest.findUnique({ where: { id }, select: { status: true, proposed: true, studentId: true, student: { select: { firstName: true, lastName: true } } } });
    if (!request) return fail("That request no longer exists.");
    if (request.status !== "PENDING") return fail("That request has already been decided.");
    const proposed = request.proposed as Partial<Record<ChangeableField, string>>;
    const data = Object.fromEntries(CHANGEABLE_FIELDS.filter((f) => proposed[f] !== undefined).map((f) => [f, proposed[f]!.trim() === "" ? null : proposed[f]!.trim()]));
    if (Object.keys(data).length === 0) return fail("That request has nothing to apply.");
    // Only transition a still-pending request; a concurrent decision wins once.
    const moved = await tx.parentChangeRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPLIED", reply: cleanReply(reply), reviewedById: who.id, reviewedByName: who.name, reviewedAt: new Date() } });
    if (moved.count !== 1) return fail("That request has already been decided.");
    await tx.student.update({ where: { id: request.studentId }, data });
    await logAudit({
      actorId: who.id, actorName: who.name, action: "apply-parent-change", entity: "Student", entityId: request.studentId,
      summary: `Applied a parent's changes to ${request.student.firstName} ${request.student.lastName}: ${Object.keys(data).map((f) => CHANGE_FIELD_LABELS[f as ChangeableField].toLowerCase()).join(", ")}`,
      details: { requestId: id, fields: Object.keys(data) },
    }, tx);
    return ok();
  });
  if (result.ok) { revalidatePath("/students/parent-changes"); revalidatePath("/students"); }
  return result;
}

export async function declineParentChange(id: string, reply: string): Promise<ActionResult> {
  const session = await requirePermission("students.manage");
  const who = reviewer(session);
  const message = cleanReply(reply);
  if (message.length < 3) return fail("Tell the parent briefly why, so they know what to do next.");
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.parentChangeRequest.findUnique({ where: { id }, select: { studentId: true, student: { select: { firstName: true, lastName: true } } } });
    if (!request) return fail("That request no longer exists.");
    const moved = await tx.parentChangeRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "DECLINED", reply: message, reviewedById: who.id, reviewedByName: who.name, reviewedAt: new Date() } });
    if (moved.count !== 1) return fail("That request has already been decided.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "decline-parent-change", entity: "Student", entityId: request.studentId, summary: `Declined a parent's changes to ${request.student.firstName} ${request.student.lastName}`, details: { requestId: id } }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/students/parent-changes");
  return result;
}
