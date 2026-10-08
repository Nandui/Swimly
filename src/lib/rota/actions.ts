"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { currentActor, mayFor } from "@/lib/policy/session";
import { canChange } from "@/lib/rota/access";
import { BOOKING_KINDS, ROTA_CHANGE_REASONS, addDaysIso, bookingDates, clock, mondayOf, parseClock } from "@/lib/rota/constants";
import { placeProblem } from "@/lib/rota/cover";
import { areaProblem } from "@/lib/setup/data";
import { fitsFor } from "@/lib/rota/data";
import type { Prisma } from "@/generated/prisma/client";
import { notifyShiftChange } from "@/lib/staff-api/reminders";
import { commitmentsFor, planCommitment } from "@/modules/server";

/** Rota writes (owner decisions, 6 October 2026). Plan changes the days after today for the
 *  departments the person belongs to; Run changes any day for every department. Nothing is
 *  refused for a warning (an expired qualification, a double booking): those show on the plan.
 *  A change to today or an earlier day asks for its reason and goes in the day's log with an
 *  "Update Timepoint" follow-up. Once a week is shared, the people a change moves are told. */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const CLASSES = "activities.classes";

const changeSchema = z.object({
  reason: z.enum(["", ...ROTA_CHANGE_REASONS]).default(""),
  note: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
});
export type ChangeInput = z.input<typeof changeSchema>;
const NEEDS_REASON = "This day has come, so the change goes in the day's log. Say why it changed.";

type Allowed = { ok: true; actor: { id: string; name: string }; site: { id: string; name: string; orgId: string }; live: boolean } | { ok: false; error: string };

/** May the signed-in person change this department's plan on this day at this site? */
async function allowedFor(siteId: string, date: string, departmentId: string): Promise<Allowed> {
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return { ok: false, error: "That site is not open." };
  const actor = await currentActor();
  const resource = { siteId, orgId: site.orgId };
  const [run, plan] = await Promise.all([mayFor("rota.manage", resource), mayFor("rota.plan", resource)]);
  if (!run && !plan) return { ok: false, error: "You can only plan the rota at the sites your role covers." };
  const now = today();
  const member = new Set((await prisma.userDepartment.findMany({ where: { userId: actor.id }, select: { departmentId: true } })).map((m) => m.departmentId));
  if (!canChange({ plan, run }, date, now, departmentId, member)) {
    return { ok: false, error: date <= now ? "Today and earlier days are changed by the duty manager." : "You plan only the departments you belong to." };
  }
  return { ok: true, actor: { id: actor.id, name: actor.name }, site: { id: site.id, name: site.name, orgId: site.orgId }, live: date <= now };
}

function refresh() {
  revalidatePath("/rota");
  revalidatePath("/rota/today");
  revalidatePath("/rota/overview");
}

/** Is this department's week shared with its staff? Then the people a change moves are told. */
async function shared(tx: Prisma.TransactionClient | typeof prisma, siteId: string, departmentId: string, date: string) {
  return !!(await tx.rotaWeekShare.findUnique({ where: { siteId_departmentId_monday: { siteId, departmentId, monday: parseDateOnly(mondayOf(date)) } }, select: { id: true } }));
}

/** The absence a cover change covers: the person taken off is off that day. */
async function coveredAbsence(tx: Prisma.TransactionClient, userId: string | null, date: string) {
  if (!userId) return null;
  const on = parseDateOnly(date);
  return (await tx.rotaAbsence.findFirst({ where: { userId, withdrawnAt: null, firstDay: { lte: on }, OR: [{ lastDay: null }, { lastDay: { gte: on } }] }, select: { id: true } }))?.id ?? null;
}

async function logLive(tx: Prisma.TransactionClient, at: Extract<Allowed, { ok: true }>, date: string, kind: string, summary: string, userId: string | null, change: z.output<typeof changeSchema>, coverFor: string | null = null) {
  await tx.rotaLog.create({ data: {
    orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(date), kind, summary, userId, reason: change.reason, note: change.note,
    absenceId: change.reason === "cover" ? await coveredAbsence(tx, coverFor, date) : null, byId: at.actor.id, byName: at.actor.name,
  } });
}

/* ---------- Activities on a day ---------- */

const needSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  typeId: z.string().min(1, "Choose the activity."),
  place: z.string().trim().max(60, "Keep the place under 60 characters."),
  start: z.string(),
  end: z.string(),
  places: z.coerce.number().int().min(1, "It needs at least one person.").max(20, "Up to 20 people at once."),
  note: z.string().trim().max(300, "Keep the note under 300 characters.").default(""),
});
export type NeedInput = z.input<typeof needSchema>;

/** Add an activity to a day, or change one. Its places and times can shrink only past the
 *  people already on it: take them off first. */
export async function saveNeed(id: string | null, input: NeedInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = needSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  if (end <= start) return fail("It has to end after it starts, on the same day.");
  const type = await prisma.activityType.findFirst({ where: { id: data.typeId, archivedAt: null, fromClasses: false }, select: { id: true, name: true, orgId: true, departmentId: true } });
  if (!type) return fail("That activity is no longer on the list.");
  const at = await allowedFor(data.siteId, data.date, type.departmentId);
  if (!at.ok) return fail(at.error);
  if (type.orgId !== at.site.orgId) return fail("That activity is no longer on the list.");
  const label = `${type.name}${data.place ? `, ${data.place}` : ""}, ${data.date} ${clock(start)}–${clock(end)}`;
  const existing = id ? await prisma.rotaNeed.findFirst({ where: { id, siteId: data.siteId }, select: { date: true, typeId: true, place: true, type: { select: { departmentId: true } }, assignments: { select: { place: true, startMinutes: true, endMinutes: true } } } }) : null;
  if (id && !existing) return fail("That activity is no longer on the plan.");
  // Where it happens is one of the site's areas (Admin, Areas).
  const where = await areaProblem(data.siteId, data.place, existing?.place);
  if (where) return fail(where);
  if (existing) {
    // Moving it off its own day or department is a change there too.
    const from = await allowedFor(data.siteId, iso(existing.date), existing.type.departmentId);
    if (!from.ok) return fail(from.error);
    if (iso(existing.date) !== data.date && existing.assignments.length) return fail("People are on it. Take them off before moving it to another day.");
    if (existing.assignments.some((a) => a.place > data.places)) return fail("Someone is on a place you are removing. Take them off first.");
    if (existing.assignments.some((a) => a.startMinutes < start || a.endMinutes > end)) return fail("Someone is on it outside the new times. Change their time first.");
  }
  const live = at.live || (!!existing && iso(existing.date) <= today());
  if (live && !change.reason) return fail(NEEDS_REASON);
  await prisma.$transaction(async (tx) => {
    const values = { date: parseDateOnly(data.date), typeId: type.id, place: data.place, startMinutes: start, endMinutes: end, places: data.places, note: data.note };
    if (existing) {
      await tx.rotaNeed.update({ where: { id: id! }, data: values });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaNeed", entityId: id!, clubId: at.site.id, summary: `Changed ${label}` }, tx);
    } else {
      const created = await tx.rotaNeed.create({ data: { ...values, orgId: at.site.orgId, siteId: at.site.id, createdById: at.actor.id, createdByName: at.actor.name } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaNeed", entityId: created.id, clubId: at.site.id, summary: `Added ${label}` }, tx);
    }
    if (live) await logLive(tx, at, data.date, existing ? "changed" : "added", `${existing ? "Changed" : "Added"} ${type.name}${data.place ? `, ${data.place}` : ""}, ${clock(start)} to ${clock(end)}`, null, change);
  });
  refresh();
  return ok();
}

/** Take an activity off a day, with everyone on it. */
export async function removeNeed(id: string, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const need = await prisma.rotaNeed.findFirst({ where: { id }, select: { siteId: true, date: true, place: true, startMinutes: true, endMinutes: true,
    type: { select: { name: true, departmentId: true } }, assignments: { select: { userId: true, user: { select: { name: true } } } } } });
  if (!need) return fail("That activity is no longer on the plan.");
  const date = iso(need.date);
  const at = await allowedFor(need.siteId, date, need.type.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const label = `${need.type.name}${need.place ? `, ${need.place}` : ""}, ${date} ${clock(need.startMinutes)}–${clock(need.endMinutes)}`;
  const inDay = `${need.type.name}${need.place ? `, ${need.place}` : ""}, ${clock(need.startMinutes)} to ${clock(need.endMinutes)}`;
  const tell = await shared(prisma, need.siteId, need.type.departmentId, date);
  await prisma.$transaction(async (tx) => {
    await tx.rotaNeed.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaNeed", entityId: id, clubId: at.site.id, summary: `Removed ${label}` }, tx);
    if (at.live) {
      await logLive(tx, at, date, "removed", `Removed ${inDay}`, null, change);
      for (const a of need.assignments) await logLive(tx, at, date, "removed", `${a.user.name} taken off ${inDay}`, a.userId, change, a.userId);
    }
  });
  refresh();
  if (tell) for (const a of [...new Set(need.assignments.map((x) => x.userId))]) await notifyShiftChange(a, `You are no longer on ${label} at ${at.site.name}.`);
  return ok();
}

/* ---------- People on places ---------- */

const assignSchema = z.object({
  needId: z.string().min(1),
  place: z.coerce.number().int().min(1),
  userId: z.string().min(1, "Choose who."),
  start: z.string(),
  end: z.string(),
});
export type AssignInput = z.input<typeof assignSchema>;

/** Put someone on a place of an activity for all or part of its time, or change who or when
 *  (`id`). Warnings (qualification, double booking, off that day) never refuse it. */
export async function assign(id: string | null, input: AssignInput, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 07:00.");
  const need = await prisma.rotaNeed.findFirst({ where: { id: data.needId }, select: { id: true, siteId: true, date: true, place: true, startMinutes: true, endMinutes: true, places: true,
    type: { select: { name: true, departmentId: true } }, assignments: { select: { id: true, needId: true, place: true, userId: true, startMinutes: true, endMinutes: true } } } });
  if (!need) return fail("That activity is no longer on the plan.");
  const date = iso(need.date);
  const at = await allowedFor(need.siteId, date, need.type.departmentId);
  if (!at.ok) return fail(at.error);
  const before = id ? need.assignments.find((a) => a.id === id) : null;
  if (id && !before) return fail("That person is no longer on this activity.");
  const problem = placeProblem(need, need.assignments, { id: id ?? undefined, needId: need.id, place: data.place, userId: data.userId, startMinutes: start, endMinutes: end });
  if (problem) return fail(problem);
  const person = await prisma.user.findFirst({ where: { id: data.userId, orgId: at.site.orgId, isActive: true }, select: { id: true, name: true } });
  if (!person) return fail("That person is no longer active.");
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const what = `${need.type.name}${need.place ? `, ${need.place}` : ""}`;
  const summary = `${person.name} on ${what}, ${date} ${clock(start)}–${clock(end)}`;
  const tell = await shared(prisma, need.siteId, need.type.departmentId, date);
  const previous = before && before.userId !== person.id ? before.userId : null;
  await prisma.$transaction(async (tx) => {
    const values = { place: data.place, userId: person.id, startMinutes: start, endMinutes: end };
    if (before) await tx.rotaAssignment.update({ where: { id: before.id }, data: values });
    else await tx.rotaAssignment.create({ data: { ...values, needId: need.id, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: before ? "update" : "create", entity: "RotaAssignment", entityId: before?.id ?? null, clubId: at.site.id, summary: `Put ${summary}` }, tx);
    if (at.live) await logLive(tx, at, date, before ? "changed" : "added", `${person.name} put on ${what}, ${clock(start)} to ${clock(end)}`, person.id, change, previous);
  });
  refresh();
  if (tell) {
    await notifyShiftChange(person.id, `${before?.userId === person.id ? "Your time changed" : "You are on"} ${what} at ${at.site.name} on ${date}, ${clock(start)}–${clock(end)}.`);
    if (previous) await notifyShiftChange(previous, `You are no longer on ${what} at ${at.site.name} on ${date}.`);
  }
  return ok();
}

/** Take someone off a place; that time becomes a gap. */
export async function unassign(id: string, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const a = await prisma.rotaAssignment.findFirst({ where: { id }, select: { userId: true, startMinutes: true, endMinutes: true, user: { select: { name: true } },
    need: { select: { siteId: true, date: true, place: true, type: { select: { name: true, departmentId: true } } } } } });
  if (!a) return fail("That person is no longer on this activity.");
  const date = iso(a.need.date);
  const at = await allowedFor(a.need.siteId, date, a.need.type.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const what = `${a.need.type.name}${a.need.place ? `, ${a.need.place}` : ""}`;
  const tell = await shared(prisma, a.need.siteId, a.need.type.departmentId, date);
  await prisma.$transaction(async (tx) => {
    await tx.rotaAssignment.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaAssignment", entityId: id, clubId: at.site.id, summary: `Took ${a.user.name} off ${what}, ${date}` }, tx);
    if (at.live) await logLive(tx, at, date, "removed", `${a.user.name} taken off ${what}, ${clock(a.startMinutes)} to ${clock(a.endMinutes)}`, a.userId, change, a.userId);
  });
  refresh();
  if (tell) await notifyShiftChange(a.userId, `You are no longer on ${what} at ${at.site.name} on ${date}, ${clock(a.startMinutes)}–${clock(a.endMinutes)}.`);
  return ok();
}

/** Plan who teaches a swim class on a date (owner decision: Rota assigns instructors). The swim
 *  school keeps the record and checks the class runs; this checks the Teaching department. */
export async function planTeacher(input: { siteId: string; date: string; classRef: string; userId: string | null }, changeInput: ChangeInput = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  if (!isDateOnly(input.date)) return fail("Choose a day.");
  const actor = await currentActor();
  const teaching = await prisma.activityType.findFirst({ where: { orgId: actor.orgId ?? undefined, fromClasses: true, archivedAt: null }, select: { departmentId: true, name: true } });
  if (!teaching) return fail("Swim classes are not on the rota yet. Add a Teaching activity that takes them, on the activity list.");
  const at = await allowedFor(input.siteId, input.date, teaching.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = input.userId ? await prisma.user.findFirst({ where: { id: input.userId, orgId: at.site.orgId, isActive: true }, select: { id: true, name: true } }) : null;
  if (input.userId && !person) return fail("That person is no longer active.");
  const result = await planCommitment(CLASSES, { ref: input.classRef, siteId: at.site.id, date: input.date, userId: person?.id ?? null, by: at.actor });
  if (!result.ok) return fail(result.error);
  if (at.live) await prisma.$transaction((tx) => logLive(tx, at, input.date, "changed", `${person ? `${person.name} planned to teach` : "Nobody planned for"} a swim class`, person?.id ?? null, change));
  refresh();
  if (person && (await shared(prisma, at.site.id, teaching.departmentId, input.date))) await notifyShiftChange(person.id, `You are teaching a swim class at ${at.site.name} on ${input.date}.`);
  return ok();
}

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

/** "Who can fill it" for a gap, best fit first, for the sheet. Reading, so View is enough. */
export async function whoCanFill(input: { siteId: string; date: string; start: number; end: number; typeId: string }) {
  if (!isDateOnly(input.date)) return [];
  const type = await prisma.activityType.findFirst({ where: { id: input.typeId }, select: { requiredTypeId: true } });
  return fitsFor({ siteId: input.siteId, date: input.date, start: input.start, end: input.end, requiredTypeId: type?.requiredTypeId ?? null });
}

/* ---------- Copy and share ---------- */

const copySchema = z.object({
  siteId: z.string().min(1),
  departmentId: z.string().min(1),
  from: z.string().refine(isDateOnly, "Choose what to copy."),
  to: z.string().refine(isDateOnly, "Choose where to copy it."),
  days: z.union([z.literal(1), z.literal(7)]),
  /** Copy who is on each place too, or only the activities. */
  people: z.boolean(),
});
export type CopyInput = z.input<typeof copySchema>;

/** Copy a day or a week of one department onto days that have nothing of that department yet.
 *  Days already planned are left alone, so copying never overwrites work. */
export async function copyPlan(input: CopyInput): Promise<ActionResult> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { siteId, departmentId, from, to, days, people } = parsed.data;
  if (from === to) return fail("Choose a different day to copy from.");
  const targets = Array.from({ length: days }, (_, i) => addDaysIso(to, i));
  const checks = await Promise.all(targets.map((d) => allowedFor(siteId, d, departmentId)));
  const refused = checks.find((c) => !c.ok);
  if (refused && !refused.ok) return fail(refused.error);
  const at = checks[0] as Extract<Allowed, { ok: true }>;
  const source = await prisma.rotaNeed.findMany({
    where: { siteId, type: { departmentId, archivedAt: null }, date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, days - 1)) } },
    select: { date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true, note: true,
      assignments: { select: { place: true, userId: true, startMinutes: true, endMinutes: true, user: { select: { isActive: true } } } } },
  });
  if (!source.length) return fail("There is nothing of this department to copy on those days.");
  const busy = new Set((await prisma.rotaNeed.findMany({ where: { siteId, type: { departmentId }, date: { in: targets.map(parseDateOnly) } }, select: { date: true } })).map((n) => iso(n.date)));
  const offset = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  let copied = 0;
  await prisma.$transaction(async (tx) => {
    for (const n of source) {
      const date = addDaysIso(iso(n.date), offset);
      if (busy.has(date)) continue;
      await tx.rotaNeed.create({ data: {
        orgId: at.site.orgId, siteId, date: parseDateOnly(date), typeId: n.typeId, place: n.place, startMinutes: n.startMinutes, endMinutes: n.endMinutes, places: n.places, note: n.note,
        createdById: at.actor.id, createdByName: at.actor.name,
        ...(people ? { assignments: { create: n.assignments.filter((a) => a.user.isActive).map((a) => ({ place: a.place, userId: a.userId, startMinutes: a.startMinutes, endMinutes: a.endMinutes, createdById: at.actor.id, createdByName: at.actor.name })) } } : {}),
      } });
      copied += 1;
    }
    // With people, their planned shifts come too.
    if (people) {
      const shifts = await tx.rotaPlanShift.findMany({ where: { siteId, departmentId, date: { gte: parseDateOnly(from), lte: parseDateOnly(addDaysIso(from, days - 1)) }, user: { isActive: true } },
        select: { date: true, userId: true, startMinutes: true, endMinutes: true } });
      const fresh = shifts.filter((x) => !busy.has(addDaysIso(iso(x.date), offset)));
      if (fresh.length) await tx.rotaPlanShift.createMany({ data: fresh.map((x) => ({ orgId: at.site.orgId, siteId, departmentId, date: parseDateOnly(addDaysIso(iso(x.date), offset)),
        userId: x.userId, startMinutes: x.startMinutes, endMinutes: x.endMinutes, createdById: at.actor.id, createdByName: at.actor.name })) });
    }
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaNeed", entityId: null, clubId: siteId,
      summary: `Copied ${copied} activities${people ? " with their people" : ""} from ${from} to ${to} at ${at.site.name}` }, tx);
  });
  if (!copied) return fail("Those days are already planned. Copying only fills days with nothing on them.");
  refresh();
  return ok();
}

/** Share a department's week with its staff: they see it in Turnfin Me and are told once. */
export async function shareWeek(input: { siteId: string; departmentId: string; monday: string }): Promise<ActionResult> {
  if (!isDateOnly(input.monday) || mondayOf(input.monday) !== input.monday) return fail("Choose a week.");
  const site = await prisma.club.findFirst({ where: { id: input.siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return fail("That site is not open.");
  const actor = await currentActor();
  const resource = { siteId: site.id, orgId: site.orgId };
  const run = await mayFor("rota.manage", resource);
  const member = await prisma.userDepartment.findFirst({ where: { userId: actor.id, departmentId: input.departmentId }, select: { userId: true } });
  if (!run && !((await mayFor("rota.plan", resource)) && member)) return fail("You share only the weeks of the departments you plan.");
  const department = await prisma.department.findFirst({ where: { id: input.departmentId, orgId: site.orgId }, select: { name: true } });
  if (!department) return fail("That department no longer exists.");
  const monday = parseDateOnly(input.monday);
  const existing = await prisma.rotaWeekShare.findUnique({ where: { siteId_departmentId_monday: { siteId: site.id, departmentId: input.departmentId, monday } }, select: { id: true } });
  if (existing) return ok();
  await prisma.$transaction(async (tx) => {
    await tx.rotaWeekShare.create({ data: { siteId: site.id, departmentId: input.departmentId, monday, sharedById: actor.id, sharedByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaWeekShare", entityId: null, clubId: site.id, summary: `Shared ${department.name}'s week of ${input.monday} at ${site.name}` }, tx);
  });
  const people = await prisma.rotaAssignment.findMany({
    where: { need: { siteId: site.id, type: { departmentId: input.departmentId }, date: { gte: monday, lte: parseDateOnly(addDaysIso(input.monday, 6)) } } },
    distinct: ["userId"], select: { userId: true },
  });
  const onShift = await prisma.rotaPlanShift.findMany({ where: { siteId: site.id, departmentId: input.departmentId, date: { gte: monday, lte: parseDateOnly(addDaysIso(input.monday, 6)) } }, distinct: ["userId"], select: { userId: true } });
  for (const p of onShift) if (!people.some((x) => x.userId === p.userId)) people.push(p);
  refresh();
  for (const p of people) await notifyShiftChange(p.userId, `Your ${department.name} rota for the week of ${input.monday} at ${site.name} is ready.`);
  return ok();
}

/* ---------- The duty manager's day ---------- */

/** The change is in Timepoint too: closes its follow-up. */
export async function markTimepointUpdated(logId: string): Promise<ActionResult> {
  const entry = await prisma.rotaLog.findFirst({ where: { id: logId }, select: { siteId: true, timepointAt: true, summary: true, site: { select: { orgId: true } } } });
  if (!entry) return fail("That change is no longer in the log.");
  if (entry.timepointAt) return ok();
  if (!(await mayFor("rota.manage", { siteId: entry.siteId, orgId: entry.site.orgId ?? undefined }))) return fail("Only the duty manager updates Timepoint.");
  const actor = await currentActor();
  await prisma.$transaction(async (tx) => {
    await tx.rotaLog.update({ where: { id: logId }, data: { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaLog", entityId: logId, clubId: entry.siteId, summary: `Recorded a rota change as updated in Timepoint: ${entry.summary}` }, tx);
  });
  refresh();
  return ok();
}

/** The day's note for every duty manager at the site. Empty text removes it. */
export async function saveDayNote(siteId: string, date: string, text: string): Promise<ActionResult> {
  if (!isDateOnly(date)) return fail("Choose a day.");
  const clean = text.trim();
  if (clean.length > 1000) return fail("Keep the note under 1,000 characters.");
  const site = await prisma.club.findFirst({ where: { id: siteId, archivedAt: null }, select: { id: true, name: true, orgId: true } });
  if (!site?.orgId) return fail("That site is not open.");
  if (!(await mayFor("rota.manage", { siteId, orgId: site.orgId }))) return fail("Only the duty manager keeps the day's note.");
  const actor = await currentActor();
  const day = parseDateOnly(date);
  await prisma.$transaction(async (tx) => {
    if (clean) await tx.rotaDayNote.upsert({ where: { siteId_date: { siteId, date: day } }, create: { orgId: site.orgId!, siteId, date: day, text: clean, byId: actor.id, byName: actor.name }, update: { text: clean, byId: actor.id, byName: actor.name } });
    else await tx.rotaDayNote.deleteMany({ where: { siteId, date: day } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaDayNote", entityId: null, clubId: site.id, summary: `${clean ? "Wrote" : "Cleared"} the rota note for ${date} at ${site.name}` }, tx);
  });
  refresh();
  return ok();
}

/* ---------- Repeating bookings ---------- */

const repeatSchema = z.object({
  siteId: z.string().min(1),
  kind: z.enum(BOOKING_KINDS, { message: "Choose what it is." }),
  title: z.string().trim().min(2, "Say who it is for, for example the school's name.").max(80, "Keep it under 80 characters."),
  typeId: z.string().min(1, "Choose the activity it needs."),
  place: z.string().trim().max(60, "Keep the place under 60 characters."),
  start: z.string(),
  end: z.string(),
  places: z.coerce.number().int().min(1, "It needs at least one person.").max(20, "Up to 20 people at once."),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7),
  firstDay: z.string().refine(isDateOnly, "Choose the first day."),
  lastDay: z.string().refine(isDateOnly, "Choose the last day."),
  skipDates: z.array(z.string().refine(isDateOnly, "Choose each date it does not run.")).max(120).default([]),
});
export type RepeatInput = z.input<typeof repeatSchema>;
/** The most days one booking may make, so a typo in a date cannot fill a year. */
const MAX_DAYS = 200;

/** A booking that repeats: it adds its activity on each of its days, each then planned and
 *  changed on its own. Only days after today are made. */
export async function saveRepeat(input: RepeatInput): Promise<ActionResult> {
  const parsed = repeatSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 09:30.");
  if (end <= start) return fail("It has to end after it starts.");
  if (data.lastDay < data.firstDay) return fail("The last day can't be before the first.");
  const type = await prisma.activityType.findFirst({ where: { id: data.typeId, archivedAt: null, fromClasses: false }, select: { id: true, name: true, departmentId: true } });
  if (!type) return fail("That activity is no longer on the list.");
  const now = today();
  const dates = bookingDates(data.firstDay > now ? data.firstDay : addDaysIso(now, 1), data.lastDay, data.weekdays, data.skipDates);
  if (!dates.length) return fail("None of those days are still to come.");
  if (dates.length > MAX_DAYS) return fail(`That makes ${dates.length} days. Keep a booking to ${MAX_DAYS} days.`);
  const at = await allowedFor(data.siteId, dates[0], type.departmentId);
  const where = await areaProblem(data.siteId, data.place);
  if (where) return fail(where);
  if (!at.ok) return fail(at.error);
  await prisma.$transaction(async (tx) => {
    const repeat = await tx.rotaRepeat.create({ data: {
      orgId: at.site.orgId, siteId: at.site.id, kind: data.kind, title: data.title, typeId: type.id, place: data.place, startMinutes: start, endMinutes: end, places: data.places,
      weekdays: data.weekdays, firstDay: parseDateOnly(data.firstDay), lastDay: parseDateOnly(data.lastDay), skipDates: data.skipDates.map(parseDateOnly),
      createdById: at.actor.id, createdByName: at.actor.name,
    } });
    await tx.rotaNeed.createMany({ data: dates.map((d) => ({
      orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(d), typeId: type.id, place: data.place, startMinutes: start, endMinutes: end, places: data.places,
      repeatId: repeat.id, createdById: at.actor.id, createdByName: at.actor.name,
    })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaRepeat", entityId: repeat.id, clubId: at.site.id,
      summary: `Added the booking ${data.title}: ${type.name} on ${dates.length} days from ${dates[0]}` }, tx);
  });
  refresh();
  revalidatePath("/rota/bookings");
  return ok();
}

/** Cancel a booking: its days still to come leave the plan, with anyone on them. */
export async function cancelRepeat(id: string): Promise<ActionResult> {
  const repeat = await prisma.rotaRepeat.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, title: true, type: { select: { departmentId: true } } } });
  if (!repeat) return fail("That booking is already cancelled.");
  const tomorrow = addDaysIso(today(), 1);
  const at = await allowedFor(repeat.siteId, tomorrow, repeat.type.departmentId);
  if (!at.ok) return fail(at.error);
  const future = await prisma.rotaNeed.findMany({ where: { repeatId: id, date: { gte: parseDateOnly(tomorrow) } }, select: { id: true, date: true, assignments: { select: { userId: true } } } });
  await prisma.$transaction(async (tx) => {
    await tx.rotaRepeat.update({ where: { id }, data: { cancelledAt: new Date() } });
    await tx.rotaNeed.deleteMany({ where: { id: { in: future.map((n) => n.id) } } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "cancel", entity: "RotaRepeat", entityId: id, clubId: at.site.id, summary: `Cancelled the booking ${repeat.title}: ${future.length} days to come removed` }, tx);
  });
  refresh();
  revalidatePath("/rota/bookings");
  for (const userId of [...new Set(future.flatMap((n) => n.assignments.map((a) => a.userId)))]) await notifyShiftChange(userId, `${repeat.title} at ${at.site.name} is cancelled, so you are no longer on it.`);
  return ok();
}

