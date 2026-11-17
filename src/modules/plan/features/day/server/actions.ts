"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, today } from "@/lib/format";
import { staffByIds } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { planCommitment } from "@/modules/contributions";
import { requirePlanActor } from "@/modules/plan/shared/access";
import { offsBetween, sessionsOf, shiftsAt } from "@/modules/plan/shared/data";
import { copyDay, occurrencesOn } from "@/modules/plan/shared/model";
import { blockSchema, clock, firstIssue, sessionDaySchema, type BlockInput, type SessionDayInput } from "@/modules/plan/shared/rules";
import { mayManage, mayPlanDepartment, plannableDepartments, viewableSite } from "@/modules/plan/shared/scope";

/** The Day's writes: put someone on a duty (filling a session's place or not), take them off it,
 *  choose who teaches a class (kept by its own app), and change or call off one day of a session. */

const nameOf = async (userId: string) => (await staffByIds([userId])).get(userId)?.name ?? "Someone";

/** Add or change a duty block inside a shift, with the duty's tasks chosen for it and their times. A block fills a
 *  session only for a duty that session needs, on a day it runs. */
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
  const duty = await prisma.planDuty.findFirst({ where: { id: v.dutyId, orgId: site.orgId, archivedAt: null }, include: { tasks: { orderBy: { sortOrder: "asc" } } } });
  if (!duty) return fail("That duty is no longer on the list.");
  // The tasks chosen for it come from the duty's own list in Setup; each runs for a stretch inside
  // the block, set here on the Day.
  const tasks = v.tasks.flatMap((t) => { const task = duty.tasks.find((x) => x.id === t.id); return task ? [{ id: task.id, name: task.name, at: t.at, end: t.end }] : []; })
    .sort((a, b) => a.at - b.at);
  if (tasks.length !== v.tasks.length) return fail(`${duty.name} no longer comes with one of those tasks. Open it again and choose from its list.`);
  const outside = tasks.find((t) => t.at < v.start || t.end > v.end);
  if (outside) return fail(`Keep ${outside.name} inside the duty, ${clock(v.start)} to ${clock(v.end)}.`);
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
    const data = { dutyId: duty.id, sessionId: v.sessionId, startMinutes: v.start, endMinutes: v.end, taskIds: tasks.map((t) => t.id), taskMinutes: tasks.map((t) => t.at), taskEndMinutes: tasks.map((t) => t.end) };
    const row = existing ? await tx.planBlock.update({ where: { id: existing.id }, data }) : await tx.planBlock.create({ data: { ...data, shiftId: shift.id } });
    const withTasks = tasks.length ? `, with ${tasks.map((t) => `${t.name} ${clock(t.at)} to ${clock(t.end)}`).join(", ")}` : existing?.taskIds.length ? ", with no tasks" : "";
    await logAudit({ actorId: who.id, actorName: who.name, action: existing ? "update" : "create", entity: "PlanBlock", entityId: row.id, clubId: site.id,
      summary: `${existing ? "Moved" : "Put"} ${name} on ${duty.name}${sessionTitle ? ` for ${sessionTitle}` : ""}, ${shift.date} ${clock(v.start)} to ${clock(v.end)}${withTasks}` }, tx);
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

/** Copy another day's plan into this one (owner, 16 November 2026: "the option to copy from another
 *  day should one exist"): the shifts of the departments the person may plan, at the same times,
 *  with their duties and the tasks chosen for them, and who filled each session that also runs
 *  this day. Skips people marked off and never touches a shift already on this day. */
export async function copyDayPlan(siteId: string, from: string, to: string): Promise<ActionResult & { copied?: number }> {
  const who = await requirePlanActor();
  if (!isDateOnly(from) || !isDateOnly(to)) return fail("Choose a day to copy.");
  if (from === to) return fail("Choose another day to copy from.");
  if (to < today()) return fail("A day that has passed can't be planned.");
  const site = await viewableSite(siteId);
  if (!site) return fail("That site is not open.");
  const mine = new Set((await plannableDepartments(who, site.id, site.orgId)).mine.map((d) => d.id));
  if (!mine.size) return fail("You can't plan a department at this site.");
  const [source, here, sessions] = await Promise.all([shiftsAt(site.orgId, site.id, from, from), shiftsAt(site.orgId, site.id, to, to), sessionsOf(site.orgId, site.id, to, to)]);
  const theirs = source.filter((s) => mine.has(s.departmentId));
  if (!theirs.length) return fail("That day has no shifts you can copy.");
  const offs = await offsBetween(site.orgId, to, to, theirs.map((s) => s.userId));
  const running = new Set(occurrencesOn(sessions, to).map((o) => o.sessionId));
  const copies = copyDay(theirs, to, { existing: here.map((s) => s.userId), offOn: (userId) => offs.some((o) => o.userId === userId), runsOn: (sessionId) => running.has(sessionId) });
  if (!copies.length) return fail("Everyone on that day's plan is already planned this day, or marked off.");
  await prisma.$transaction(async (tx) => {
    for (const s of copies) {
      await tx.planShift.create({ data: {
        orgId: site.orgId, siteId: site.id, departmentId: s.departmentId, userId: s.userId, date: to, startMinutes: s.start, endMinutes: s.end, note: s.note,
        createdById: who.id, createdByName: who.name,
        blocks: { create: s.blocks.map((b) => ({ dutyId: b.dutyId, sessionId: b.sessionId, startMinutes: b.start, endMinutes: b.end, taskIds: b.tasks.map((t) => t.id), taskMinutes: b.tasks.map((t) => t.at), taskEndMinutes: b.tasks.map((t) => t.end) })) },
      } });
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PlanShift", clubId: site.id,
      summary: `Copied ${copies.length} shift${copies.length === 1 ? "" : "s"} from ${from} to ${to}` }, tx);
  });
  revalidatePath("/plan", "layout");
  return { ok: true, copied: copies.length };
}
