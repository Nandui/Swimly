"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { clock, parseClock } from "@/modules/rota/shared/constants";
import { fitsFor } from "@/modules/rota/shared/data";
import { notifyShiftChange } from "@/lib/staff-api/notify";
import { commitmentsFor } from "@/modules/server";
import { type ChangeInput } from "@/modules/rota/shared/actions";
import { CLASSES, NEEDS_REASON, allowedFor, changeSchema, iso, logLive, refresh, shared } from "@/modules/rota/shared/writes";

/* ---------- Shifts and breaks (owner decision, 8 October 2026) ---------- */

const planShiftSchema = z.object({
  siteId: z.string().min(1),
  departmentId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  userId: z.string().min(1, "Choose who."),
  start: z.string(),
  end: z.string(),
});
export type PlanShiftInput = z.input<typeof planShiftSchema>;

/** Put someone on a shift on a department's plan before their activities, or change its times
 *  (`id`). Their activities then fill it from the day's gaps. Two shifts of theirs at the same
 *  site may not overlap; anything else (off that day, under-18 rest, another site) is a warning. */
export async function savePlanShift(id: string | null, input: PlanShiftInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = planShiftSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  if (end - start < 15) return fail("The shift ends before it starts.");
  const before = id ? await prisma.rotaPlanShift.findFirst({ where: { id }, select: { id: true, siteId: true, departmentId: true, date: true, userId: true, startMinutes: true, endMinutes: true } }) : null;
  if (id && !before) return fail("That shift is no longer on the plan.");
  const siteId = before?.siteId ?? data.siteId, departmentId = before?.departmentId ?? data.departmentId, date = before ? iso(before.date) : data.date;
  const at = await allowedFor(siteId, date, departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const department = await prisma.department.findFirst({ where: { id: departmentId, orgId: at.site.orgId, archivedAt: null }, select: { name: true } });
  if (!department) return fail("That department no longer exists.");
  const person = await prisma.user.findFirst({ where: { id: before?.userId ?? data.userId, orgId: at.site.orgId, isActive: true }, select: { id: true, name: true } });
  if (!person) return fail("That person is no longer active.");
  const clash = await prisma.rotaPlanShift.findFirst({ where: { userId: person.id, siteId, date: parseDateOnly(date), id: id ? { not: id } : undefined, startMinutes: { lt: end }, endMinutes: { gt: start } }, select: { startMinutes: true, endMinutes: true } });
  if (clash) return fail(`${person.name} is already on a shift here from ${clock(clash.startMinutes)} to ${clock(clash.endMinutes)}. Change that one instead.`);
  const summary = `${person.name} on a ${department.name} shift, ${date} ${clock(start)}–${clock(end)}`;
  const tell = await shared(prisma, siteId, departmentId, date);
  await prisma.$transaction(async (tx) => {
    const row = before
      ? await tx.rotaPlanShift.update({ where: { id: before.id }, data: { startMinutes: start, endMinutes: end } })
      : await tx.rotaPlanShift.create({ data: { orgId: at.site.orgId, siteId, departmentId, date: parseDateOnly(date), userId: person.id, startMinutes: start, endMinutes: end, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: before ? "update" : "create", entity: "RotaPlanShift", entityId: row.id, clubId: siteId,
      summary: before ? `Changed ${summary} (was ${clock(before.startMinutes)}–${clock(before.endMinutes)})` : `Put ${summary}` }, tx);
    if (at.live) await logLive(tx, at, date, before ? "changed" : "added", `${person.name} ${before ? "shift changed to" : "put on a shift"} ${clock(start)} to ${clock(end)}`, person.id, change);
  });
  refresh();
  if (tell) await notifyShiftChange(person.id, `${before ? "Your shift changed" : "You are on a shift"} at ${at.site.name} on ${date}, ${clock(start)}–${clock(end)}.`);
  return ok();
}

/** Take a shift off the plan. Activities they are on stay, with a shift worked out from them;
 *  breaks placed in it go. */
export async function removePlanShift(id: string, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const shift = await prisma.rotaPlanShift.findFirst({ where: { id }, select: { siteId: true, departmentId: true, date: true, userId: true, startMinutes: true, endMinutes: true, user: { select: { name: true } } } });
  if (!shift) return fail("That shift is no longer on the plan.");
  const date = iso(shift.date);
  const at = await allowedFor(shift.siteId, date, shift.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const tell = await shared(prisma, shift.siteId, shift.departmentId, date);
  await prisma.$transaction(async (tx) => {
    await tx.rotaPlanShift.delete({ where: { id } });
    await tx.rotaBreak.deleteMany({ where: { siteId: shift.siteId, date: shift.date, userId: shift.userId, startMinutes: { gte: shift.startMinutes, lt: shift.endMinutes } } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaPlanShift", entityId: id, clubId: shift.siteId,
      summary: `Took ${shift.user.name}'s shift off the plan, ${date} ${clock(shift.startMinutes)}–${clock(shift.endMinutes)}` }, tx);
    if (at.live) await logLive(tx, at, date, "removed", `${shift.user.name}'s shift ${clock(shift.startMinutes)} to ${clock(shift.endMinutes)} taken off`, shift.userId, change, shift.userId);
  });
  refresh();
  if (tell) await notifyShiftChange(shift.userId, `Your shift at ${at.site.name} on ${date}, ${clock(shift.startMinutes)}–${clock(shift.endMinutes)}, is off the plan.`);
  return ok();
}

const breaksSchema = z.object({
  siteId: z.string().min(1),
  departmentId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  userId: z.string().min(1),
  breaks: z.array(z.object({ start: z.string(), minutes: z.coerce.number().int().min(5).max(120), paid: z.boolean() })).max(6),
});
export type BreaksInput = z.input<typeof breaksSchema>;

/** Place someone's breaks for a day at a site (handbook: "all breaks will be allocated by the
 *  Manager on shift"). Replaces the ones placed before; none puts them back to suggestions. A
 *  break during an activity is allowed: the plan then shows that time needs cover. */
export async function saveBreaks(input: BreaksInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = breaksSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const { siteId, departmentId, date, userId } = parsed.data;
  const at = await allowedFor(siteId, date, departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const on = parseDateOnly(date);
  // They are on this department's plan that day: a shift on it, one of its activities, or (for
  // the department that takes the swim classes) a class they teach here.
  const [person, onPlan, teaching] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, orgId: at.site.orgId }, select: { id: true, name: true } }),
    prisma.rotaPlanShift.findFirst({ where: { siteId, departmentId, date: on, userId }, select: { id: true } })
      .then(async (x) => x ?? prisma.rotaAssignment.findFirst({ where: { userId, need: { siteId, date: on, type: { departmentId } } }, select: { id: true } })),
    prisma.activityType.findFirst({ where: { orgId: at.site.orgId, fromClasses: true, departmentId }, select: { id: true } }),
  ]);
  if (!person) return fail("That person is no longer here.");
  const teaches = !onPlan && teaching
    ? (await commitmentsFor({ userIds: [userId], from: date, to: date })).some((c) => c.source === CLASSES && c.siteId === siteId)
    : false;
  if (!onPlan && !teaches) return fail(`${person.name} is not on this department's plan that day.`);
  const breaks: { start: number; minutes: number; paid: boolean }[] = [];
  for (const b of parsed.data.breaks) {
    const start = parseClock(b.start);
    if (start === null || start + b.minutes > 1440) return fail("Use times like 11:30.");
    breaks.push({ start, minutes: b.minutes, paid: b.paid });
  }
  breaks.sort((a, b) => a.start - b.start);
  if (breaks.some((b, i) => i > 0 && breaks[i - 1].start + breaks[i - 1].minutes > b.start)) return fail("Two breaks overlap. Move one.");
  const words = breaks.length ? breaks.map((b) => `${b.minutes} min ${b.paid ? "paid" : "unpaid"} at ${clock(b.start)}`).join(", ") : "back to the suggested times";
  await prisma.$transaction(async (tx) => {
    await tx.rotaBreak.deleteMany({ where: { siteId, date: on, userId } });
    if (breaks.length) await tx.rotaBreak.createMany({ data: breaks.map((b) => ({ orgId: at.site.orgId, siteId, date: on, userId, startMinutes: b.start, minutes: b.minutes, paid: b.paid, byId: at.actor.id, byName: at.actor.name })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaBreak", entityId: null, clubId: siteId, summary: `Placed ${person.name}'s breaks on ${date}: ${words}` }, tx);
    if (at.live) await logLive(tx, at, date, "changed", `${person.name}'s breaks: ${words}`, person.id, change);
  });
  refresh();
  return ok();
}

/** Who could go on a shift at a site: everyone who works there, best fit first (off that day,
 *  already busy and long days last). Reading, so View is enough. */
export async function whoForShift(input: { siteId: string; date: string; start: number; end: number }) {
  if (!isDateOnly(input.date)) return [];
  return fitsFor({ siteId: input.siteId, date: input.date, start: input.start, end: input.end, requiredTypeId: null });
}
