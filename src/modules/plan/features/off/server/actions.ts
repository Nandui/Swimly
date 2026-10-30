"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activePlacedStaff, staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requirePlanActor, type PlanActor } from "@/modules/plan/shared/access";
import { firstIssue, offReasonMeta, offSchema, type OffInput } from "@/modules/plan/shared/rules";
import { mayPlanDepartment, viewableSite } from "@/modules/plan/shared/scope";

/** Mark someone off, or take it back (recorded in error). Whoever plans one of the person's
 *  departments at the site may. */

async function mayMarkOff(who: PlanActor, siteId: string, userId: string) {
  const site = await viewableSite(siteId);
  if (!site) return null;
  const [person] = await activePlacedStaff(site.orgId, { kind: "some", userIds: new Set([userId]) });
  if (!person) return null;
  for (const departmentId of person.departmentIds) if (await mayPlanDepartment(who, site.id, site.orgId, departmentId)) return site;
  return null;
}

export async function markOff(siteId: string, input: OffInput): Promise<ActionResult> {
  const who = await requirePlanActor();
  const parsed = offSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const site = await mayMarkOff(who, siteId, v.userId);
  if (!site) return fail("You can only mark off people in the departments you plan.");
  const name = (await staffByIds([v.userId])).get(v.userId)?.name ?? "Someone";
  await prisma.$transaction(async (tx) => {
    const row = await tx.planOff.create({ data: { orgId: site.orgId, userId: v.userId, firstDay: v.firstDay, lastDay: v.lastDay, reason: v.reason, note: v.note, byId: who.id, byName: who.name } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PlanOff", entityId: row.id, clubId: site.id,
      summary: `Marked ${name} off (${offReasonMeta(v.reason).label.toLowerCase()}), ${v.firstDay} to ${v.lastDay}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}

export async function withdrawOff(siteId: string, id: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const off = await prisma.planOff.findFirst({ where: { id, orgId: who.orgId ?? undefined, withdrawnAt: null } });
  if (!off) return fail("That is no longer on the plan.");
  const site = await mayMarkOff(who, siteId, off.userId);
  if (!site) return fail("You can only change people in the departments you plan.");
  const name = (await staffByIds([off.userId])).get(off.userId)?.name ?? "Someone";
  await prisma.$transaction(async (tx) => {
    await tx.planOff.update({ where: { id }, data: { withdrawnAt: new Date() } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "withdraw", entity: "PlanOff", entityId: id, clubId: site.id,
      summary: `Took back ${name}'s day off, ${off.firstDay} to ${off.lastDay}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}
