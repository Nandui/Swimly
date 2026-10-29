"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isActiveStaff, staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { clock, firstIssue, shiftSchema, type ShiftInput } from "@/modules/plan/shared/rules";
import { mayPlanDepartment, viewableSite } from "@/modules/plan/shared/scope";

/** Shifts: add, change and remove, from the Week and the Day. A person has at most one shift at a
 *  site on a day; changing a shift's times keeps its blocks (any now outside it are warned about). */

const nameOf = async (userId: string) => (await staffByIds([userId])).get(userId)?.name ?? "Someone";

export async function saveShift(input: ShiftInput, id?: string): Promise<ActionResult & { id?: string }> {
  const who = await requirePlanActor();
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const site = await viewableSite(v.siteId);
  if (!site) return fail("That site is not open.");
  if (!(await mayPlanDepartment(who, site.id, site.orgId, v.departmentId))) return fail("You can't plan that department at this site.");
  if (!id && !(await isActiveStaff(v.userId))) return fail("That person is no longer active.");
  const name = await nameOf(v.userId);
  const result = await prisma.$transaction(async (tx) => {
    const existing = id ? await tx.planShift.findFirst({ where: { id, orgId: site.orgId, siteId: site.id } }) : null;
    if (id && !existing) return fail("That shift no longer exists.");
    if (existing && !(await mayPlanDepartment(who, site.id, site.orgId, existing.departmentId))) return fail("You can't plan that department at this site.");
    const twin = await tx.planShift.findFirst({ where: { orgId: site.orgId, siteId: site.id, userId: v.userId, date: v.date, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
    if (twin) return fail(`${name} already has a shift here that day. Change that one instead.`);
    const data = { departmentId: v.departmentId, userId: v.userId, date: v.date, startMinutes: v.start, endMinutes: v.end, note: v.note };
    const row = existing
      ? await tx.planShift.update({ where: { id: existing.id }, data })
      : await tx.planShift.create({ data: { ...data, orgId: site.orgId, siteId: site.id, createdById: who.id, createdByName: who.name } });
    await logAudit({ actorId: who.id, actorName: who.name, action: existing ? "update" : "create", entity: "PlanShift", entityId: row.id, clubId: site.id,
      summary: `${existing ? "Changed" : "Planned"} ${name}'s shift on ${v.date}, ${clock(v.start)} to ${clock(v.end)}` }, tx);
    return { ok: true as const, id: row.id };
  });
  if (!result.ok) return result;
  revalidatePath("/plan", "layout");
  return result;
}

/** Remove a shift and its blocks. */
export async function removeShift(id: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const shift = await prisma.planShift.findFirst({ where: { id, orgId: who.orgId ?? undefined } });
  if (!shift) return fail("That shift no longer exists.");
  const site = await viewableSite(shift.siteId);
  if (!site || !(await mayPlanDepartment(who, site.id, site.orgId, shift.departmentId))) return fail("You can't plan that department at this site.");
  const name = await nameOf(shift.userId);
  await prisma.$transaction(async (tx) => {
    await tx.planShift.delete({ where: { id: shift.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "PlanShift", entityId: shift.id, clubId: site.id,
      summary: `Removed ${name}'s shift on ${shift.date}, ${clock(shift.startMinutes)} to ${clock(shift.endMinutes)}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}
