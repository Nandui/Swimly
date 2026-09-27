"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Applies or declines a person's own details change from Turnfin Me. Applying
 *  writes only the fields they proposed; the audit names fields, never values.
 *  Nobody reviews their own request. Decided once. */

const FIELDS = ["phone", "homeAddress", "emergencyName", "emergencyPhone", "emergencyRelationship"] as const;
const clean = (value: unknown) => String(value ?? "").trim().slice(0, 500);

async function reviewer() {
  const session = await requirePermission("staff.manage");
  return { id: session.user.id, name: session.user.name ?? "Staff", orgId: session.user.orgId ?? null };
}

export async function applyDetailChange(id: string, reply: string): Promise<ActionResult> {
  const who = await reviewer();
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.staffDetailChangeRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
    if (!row) return fail("That request no longer exists.");
    if (row.userId === who.id) return fail("Someone else has to review your own details.");
    if (row.status !== "PENDING") return fail("That request has already been decided.");
    const proposed = row.proposed as Partial<Record<(typeof FIELDS)[number], string>>;
    const data = Object.fromEntries(FIELDS.filter((f) => proposed[f] !== undefined).map((f) => [f, proposed[f]!.trim() || null]));
    const moved = await tx.staffDetailChangeRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "APPLIED", reply: clean(reply), reviewedById: who.id, reviewedByName: who.name, reviewedAt: new Date() } });
    if (moved.count !== 1) return fail("That request has already been decided.");
    const person = await tx.user.update({ where: { id: row.userId }, data, select: { name: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "apply-details-change", entity: "User", entityId: row.userId,
      summary: `Applied ${person.name}'s changes to their ${Object.keys(data).join(", ")}`, details: { requestId: id } }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/staff/details-requests");
  return result;
}

export async function declineDetailChange(id: string, reply: string): Promise<ActionResult> {
  const who = await reviewer();
  const message = clean(reply);
  if (message.length < 3) return fail("Tell them briefly why, so they know what to do next.");
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.staffDetailChangeRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { userId: true } });
    if (!row) return fail("That request no longer exists.");
    if (row.userId === who.id) return fail("Someone else has to review your own details.");
    const moved = await tx.staffDetailChangeRequest.updateMany({ where: { id, status: "PENDING" }, data: { status: "DECLINED", reply: message, reviewedById: who.id, reviewedByName: who.name, reviewedAt: new Date() } });
    if (moved.count !== 1) return fail("That request has already been decided.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "decline-details-change", entity: "User", entityId: row.userId, summary: "Declined a details change from Turnfin Me", details: { requestId: id } }, tx);
    return ok();
  });
  if (result.ok) revalidatePath("/staff/details-requests");
  return result;
}
