"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly } from "@/lib/format";
import { staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { planCommitment } from "@/modules/contributions";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { sessionsOf } from "@/modules/plan/shared/data";
import { occurrencesOn } from "@/modules/plan/shared/model";
import { blockSchema, clock, firstIssue, sessionDaySchema, type BlockInput, type SessionDayInput } from "@/modules/plan/shared/rules";
import { mayManage, mayPlanDepartment, viewableSite } from "@/modules/plan/shared/scope";

/** The Day's writes: put someone on a duty (filling a session's place or not), take them off it,
 *  choose who teaches a class (kept by its own app), and change or call off one day of a session. */

const nameOf = async (userId: string) => (await staffByIds([userId])).get(userId)?.name ?? "Someone";

/** Add or change a duty block inside a shift. A block fills a session only for a duty that
 *  session needs, on a day it runs. */
export async function saveBlock(input: BlockInput, id?: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const shift = await prisma.planShift.findFirst({ where: { id: v.shiftId, orgId: who.orgId ?? undefined } });
  if (!shift) return fail("That shift no longer exists.");
  const site = await viewableSite(shift.siteId);
  if (!site || !(await mayPlanDepartment(who, site.id, site.orgId, shift.departmentId))) return fail("You can't plan that department at this site.");
  if (v.start < shift.startMinutes || v.end > shift.endMinutes) return fail(`Keep it inside the shift, ${clock(shift.startMinutes)} to ${clock(shift.endMinutes)}, or change the shift first.`);
  const duty = await prisma.planDuty.findFirst({ where: { id: v.dutyId, orgId: site.orgId, archivedAt: null } });
  if (!duty) return fail("That duty is no longer on the list.");
  let sessionTitle: string | null = null;
  if (v.sessionId) {
    const [session] = (await sessionsOf(site.orgId, site.id, shift.date, shift.date)).filter((s) => s.id === v.sessionId);
    const on = session ? occurrencesOn([session], shift.date)[0] : null;
    if (!session || !on) return fail("That session isn't on that day.");
    if (duty.isBreak || !session.needs.some((n) => n.dutyId === duty.id)) return fail(`${session.title} doesn't need ${duty.name}.`);
    if (v.start < on.start || v.end > on.end) return fail(`${session.title} runs ${clock(on.start)} to ${clock(on.end)}; keep it inside that.`);
    sessionTitle = session.title;
  }
  const name = await nameOf(shift.userId);
  const result = await prisma.$transaction(async (tx) => {
    const existing = id ? await tx.planBlock.findFirst({ where: { id, shiftId: shift.id } }) : null;
    if (id && !existing) return fail("That duty is no longer on the shift.");
    const data = { dutyId: duty.id, sessionId: v.sessionId, startMinutes: v.start, endMinutes: v.end };
    const row = existing ? await tx.planBlock.update({ where: { id: existing.id }, data }) : await tx.planBlock.create({ data: { ...data, shiftId: shift.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: existing ? "update" : "create", entity: "PlanBlock", entityId: row.id, clubId: site.id,
      summary: `${existing ? "Moved" : "Put"} ${name} on ${duty.name}${sessionTitle ? ` for ${sessionTitle}` : ""}, ${shift.date} ${clock(v.start)} to ${clock(v.end)}` }, tx);
    return ok();
  });
  if (!result.ok) return result;
  revalidatePath("/plan", "layout");
  return ok();
}

export async function removeBlock(id: string): Promise<ActionResult> {
  const who = await requirePlanActor();
  const block = await prisma.planBlock.findFirst({ where: { id, shift: { orgId: who.orgId ?? undefined } }, include: { shift: true, duty: { select: { name: true } } } });
  if (!block) return fail("That duty is no longer on the shift.");
  const site = await viewableSite(block.shift.siteId);
  if (!site || !(await mayPlanDepartment(who, site.id, site.orgId, block.shift.departmentId))) return fail("You can't plan that department at this site.");
  const name = await nameOf(block.shift.userId);
  await prisma.$transaction(async (tx) => {
    await tx.planBlock.delete({ where: { id: block.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "PlanBlock", entityId: block.id, clubId: site.id,
      summary: `Took ${name} off ${block.duty.name}, ${block.shift.date} ${clock(block.startMinutes)} to ${clock(block.endMinutes)}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}

/** Choose who teaches one class on one day, or nobody. The class's own app keeps the record and
 *  its audit (owner, 29 October 2026: Plan (test) plans class teachers; the old Rota writes the
 *  same record, so the two always agree). Planned by whoever plans the class duty's department. */
export async function planClassTeacher(input: { source: string; ref: string; siteId: string; date: string; userId: string | null }): Promise<ActionResult> {
  const who = await requirePlanActor();
  if (!isDateOnly(input.date) || !input.ref || !input.source) return fail("That class can't be planned from here.");
  const site = await viewableSite(input.siteId);
  if (!site) return fail("That site is not open.");
  const duty = await prisma.planDuty.findFirst({ where: { orgId: site.orgId, forClasses: true, archivedAt: null } });
  if (!duty) return fail("No duty is set up for classes yet. Ask a manager to mark one in Setup.");
  const allowed = duty.departmentId ? await mayPlanDepartment(who, site.id, site.orgId, duty.departmentId) : await mayManage(site.id, site.orgId);
  if (!allowed) return fail("You can't plan class teachers at this site.");
  const result = await planCommitment(input.source, { ref: input.ref, siteId: site.id, date: input.date, userId: input.userId, by: { id: who.id, name: who.name } });
  if (!result.ok) return result;
  revalidatePath("/plan", "layout");
  return ok();
}

/** Change one day of a repeating session (new times), call it off that day, or put it back. Manage only. */
export async function setSessionDay(input: SessionDayInput & { restore?: boolean }): Promise<ActionResult> {
  const who = await requirePlanActor();
  const parsed = sessionDaySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error));
  const v = parsed.data;
  const session = await prisma.planSession.findFirst({ where: { id: v.sessionId, orgId: who.orgId ?? undefined, cancelledAt: null } });
  if (!session) return fail("That session no longer exists.");
  const site = await viewableSite(session.siteId);
  if (!site || !(await mayManage(site.id, site.orgId))) return fail("Only someone who manages the plan here can change what's on.");
  if (v.date < session.firstDay || v.date > session.lastDay) return fail("That day is outside the session's dates.");
  await prisma.$transaction(async (tx) => {
    if (input.restore) await tx.planSessionDay.deleteMany({ where: { sessionId: session.id, date: v.date } });
    else await tx.planSessionDay.upsert({
      where: { sessionId_date: { sessionId: session.id, date: v.date } },
      create: { sessionId: session.id, date: v.date, cancelled: v.cancelled, startMinutes: v.cancelled ? null : v.start, endMinutes: v.cancelled ? null : v.end },
      update: { cancelled: v.cancelled, startMinutes: v.cancelled ? null : v.start, endMinutes: v.cancelled ? null : v.end },
    });
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "PlanSession", entityId: session.id, clubId: site.id,
      summary: input.restore ? `Put ${session.title} back to its usual times on ${v.date}`
        : v.cancelled ? `Called off ${session.title} on ${v.date}` : `Moved ${session.title} on ${v.date} to ${clock(v.start!)} to ${clock(v.end!)}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return ok();
}
