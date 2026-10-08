"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";

/** Applies or declines a person's own details change from Turnfin Me. Staff
 *  details are HR's: the reviewer needs `hr.details.write` for that person
 *  (restricted, recent password). Applying writes only the fields they
 *  proposed; the audit names fields, never values. Nobody reviews their own
 *  request. Decided once. */

const FIELDS = ["phone", "homeAddress", "emergencyName", "emergencyPhone", "emergencyRelationship"] as const;
const clean = (value: unknown) => String(value ?? "").trim().slice(0, 500);
const refresh = (userId: string) => { revalidatePath("/hr/details-requests"); revalidatePath(`/hr/people/${userId}`); };

type Reviewer = { ok: true; who: { id: string; name: string; orgId: string | null }; userId: string } | { ok: false; error: string };
async function reviewer(id: string): Promise<Reviewer> {
  const session = await requireSession();
  const orgId = session.user.orgId ?? null;
  const row = await prisma.staffDetailChangeRequest.findFirst({ where: { id, orgId: orgId ?? undefined }, select: { userId: true } });
  if (!row) return { ok: false, error: "That request no longer exists." };
  if (row.userId === session.user.id) return { ok: false, error: "Someone else has to review your own details." };
  try {
    const actor = await requireCapFor("hr.details.write", { subjectUserId: row.userId, orgId });
    return { ok: true, who: { id: actor.id, name: actor.name, orgId }, userId: row.userId };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: error.message };
    throw error;
  }
}

export async function applyDetailChange(id: string, reply: string): Promise<ActionResult> {
  const allowed = await reviewer(id);
  if (!allowed.ok) return fail(allowed.error);
  const { who } = allowed;
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.staffDetailChangeRequest.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
    if (!row) return fail("That request no longer exists.");
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
  if (result.ok) refresh(allowed.userId);
  return result;
}

export async function declineDetailChange(id: string, reply: string): Promise<ActionResult> {
  const message = clean(reply);
  if (message.length < 3) return fail("Tell them briefly why, so they know what to do next.");
  const allowed = await reviewer(id);
  if (!allowed.ok) return fail(allowed.error);
  const { who } = allowed;
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.staffDetailChangeRequest.updateMany({ where: { id, orgId: who.orgId ?? undefined, status: "PENDING" }, data: { status: "DECLINED", reply: message, reviewedById: who.id, reviewedByName: who.name, reviewedAt: new Date() } });
    if (moved.count !== 1) return fail("That request has already been decided.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "decline-details-change", entity: "User", entityId: allowed.userId, summary: "Declined a details change from Turnfin Me", details: { requestId: id } }, tx);
    return ok();
  });
  if (result.ok) refresh(allowed.userId);
  return result;
}
