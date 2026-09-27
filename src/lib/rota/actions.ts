"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { clock, parseClock } from "@/lib/rota/constants";

/** Rota writes. Each needs `rota.manage` at the shift's site (a site-scoped
 *  duty role plans only its own site). Qualification problems and
 *  double-bookings are warnings on the rota, never a refusal. Audited with the
 *  shift's own site. */

const shiftSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a date."),
  start: z.string(),
  end: z.string(),
  role: z.string().trim().min(2, "Say what the shift is, for example Lifeguard.").max(60),
  requiredTypeId: z.string().trim().max(64).transform((v) => v || null),
  userId: z.string().trim().max(64).transform((v) => v || null),
  note: z.string().trim().max(300),
});
export type ShiftInput = z.input<typeof shiftSchema>;

async function allowedAt(siteId: string) {
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site) return { ok: false as const, error: "That site is not open." };
  try {
    const actor = await requireCapFor("rota.manage", { siteId, orgId: site.orgId });
    return { ok: true as const, actor, site };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, error: "You can only plan the rota at the sites your role covers." };
    throw error;
  }
}

export async function saveShift(id: string | null, input: ShiftInput): Promise<ActionResult> {
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  if (end <= start) return fail("The shift has to end after it starts, on the same day.");
  if (end - start > 16 * 60) return fail("A shift can be up to 16 hours.");
  const allowed = await allowedAt(data.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  if (!site.orgId) return fail("That site is not set up for the rota.");
  if (data.userId && !(await prisma.user.findFirst({ where: { id: data.userId, orgId: site.orgId, isActive: true }, select: { id: true } }))) {
    return fail("That person is no longer active.");
  }
  if (data.requiredTypeId && !(await prisma.qualificationType.findFirst({ where: { id: data.requiredTypeId, orgId: site.orgId }, select: { id: true } }))) {
    return fail("That qualification is no longer offered.");
  }
  const values = {
    siteId: site.id, date: parseDateOnly(data.date), startMinutes: start, endMinutes: end, role: data.role,
    requiredTypeId: data.requiredTypeId, userId: data.userId, note: data.note,
  };
  const summary = `${data.role} at ${site.name} on ${data.date}, ${clock(start)}–${clock(end)}`;
  const result = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.rotaShift.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true } });
      if (!existing) return fail("That shift no longer exists.");
      // Moving a shift between sites needs the permission at both.
      if (existing.siteId !== site.id) {
        const from = await allowedAt(existing.siteId);
        if (!from.ok) return fail(from.error);
      }
      await tx.rotaShift.update({ where: { id }, data: values });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: id, clubId: site.id, summary: `Changed ${summary}` }, tx);
    } else {
      const created = await tx.rotaShift.create({ data: { ...values, orgId: site.orgId!, createdById: actor.id, createdByName: actor.name } });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaShift", entityId: created.id, clubId: site.id, summary: `Added ${summary}` }, tx);
    }
    return ok();
  });
  if (result.ok) { revalidatePath("/rota"); }
  return result;
}

export async function cancelShift(id: string): Promise<ActionResult> {
  const shift = await prisma.rotaShift.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, role: true, date: true } });
  if (!shift) return fail("That shift no longer exists.");
  const allowed = await allowedAt(shift.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.rotaShift.updateMany({ where: { id, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (moved.count !== 1) return fail("That shift is already cancelled.");
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "RotaShift", entityId: id, clubId: site.id, summary: `Cancelled ${shift.role} at ${site.name} on ${shift.date.toISOString().slice(0, 10)}` }, tx);
    return ok();
  });
  if (result.ok) { revalidatePath("/rota"); }
  return result;
}
