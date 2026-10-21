"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { areasAt, departmentById, staffContact } from "@/lib/directory";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { activityTypeById, subActivitiesFor } from "@/lib/setup/activity-types";
import { notifyShiftChange } from "@/lib/staff-api/notify";
import { planTeacher } from "@/modules/rota/shared/actions";
import { areaNeedsOn } from "@/modules/rota/shared/area-needs";
import { clock, parseClock, slotProblem } from "@/modules/rota/shared/constants";
import { NEEDS_REASON, allowedFor, allowedForPerson, changeSchema, iso, logLive, refresh, shared } from "@/modules/rota/shared/writes";

/** Writing in the day's diary (owner, 20 October 2026): put someone on something that needs
 *  people for a stretch (their day follows from what they are on), change or take off what
 *  someone is on, plan a shift on its own, and place breaks. Every change is in the activity log;
 *  a change to a day that has come asks why and goes in the day's log. Warnings (a qualification,
 *  a double booking, off that day) never refuse anything: the diary shows them. */

type Change = z.input<typeof changeSchema>;
function times(start: string, end: string): { ok: true; start: number; end: number } | { ok: false; error: string } {
  const s = parseClock(start), e = parseClock(end);
  if (s === null || e === null) return { ok: false, error: "Use times like 07:00." };
  if (e <= s) return { ok: false, error: "It has to end after it starts, on the same day." };
  const slot = slotProblem(s, e);
  return slot ? { ok: false, error: slot } : { ok: true, start: s, end: e };
}
/** An activity's usual sub-activities for someone on it for a stretch, ready to save: one at set
 *  times keeps the times inside the stretch, and is left off when none are. */
function usualSubs(all: Awaited<ReturnType<typeof subActivitiesFor>>, typeId: string, t: { start: number; end: number }) {
  return (all[typeId] ?? []).flatMap((x) => {
    const times = x.when === "at" ? x.times.filter((m) => m >= t.start && m <= t.end) : [];
    return x.when === "at" && !times.length ? [] : [{ subActivityId: x.id, name: x.name, when: x.when, atMinutes: times[0] ?? null, times }];
  }).map((x, i) => ({ ...x, sortOrder: i }));
}

/** The first place on a need nobody is on during the stretch; past its own places when they are
 *  all taken then (cover for someone's break). */
const freePlace = (rows: readonly { place: number; startMinutes: number; endMinutes: number }[], places: number, start: number, end: number) => {
  for (let p = 1; ; p++) if (p > places || !rows.some((r) => r.place === p && r.startMinutes < end && start < r.endMinutes)) return p;
};

const fillSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  /** The plan it is done from: an area's own need and swim classes are every department's. */
  departmentId: z.string().min(1),
  kind: z.enum(["area", "activity", "booking", "class"]),
  needId: z.string().nullable(),
  classRef: z.string().nullable(),
  userId: z.string().min(1, "Choose who."),
  start: z.string(),
  end: z.string(),
});
export type FillInput = z.input<typeof fillSchema>;

/** Put someone on something that needs people, for all or part of its time. */
export async function fillNeed(input: FillInput, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = fillSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const d = parsed.data;
  const t = times(d.start, d.end);
  if (!t.ok) return fail(t.error);
  if (d.kind === "class") {
    if (!d.classRef) return fail("That class is no longer on the timetable.");
    return planTeacher({ siteId: d.siteId, date: d.date, classRef: d.classRef, userId: d.userId, departmentId: d.departmentId }, change);
  }
  if (!d.needId) return fail("That is no longer on the day.");
  if (d.kind === "area") {
    const areas = await areasAt(d.siteId);
    const need = areaNeedsOn(areas, d.date).find((n) => n.id === d.needId);
    if (!need) return fail("That area no longer needs these staff that day. Check its hours and staff under Admin, Areas.");
    if (t.start < need.startMinutes || t.end > need.endMinutes) return fail(`Keep the time inside the hours it is open, ${clock(need.startMinutes)} to ${clock(need.endMinutes)}.`);
    if (need.activityTypeId) return fillAreaActivity({ ...d, need: { ...need, activityTypeId: need.activityTypeId }, t }, change);
    const at = await allowedForPerson(d.siteId, d.date, d.departmentId, d.userId);
    if (!at.ok) return fail(at.error);
    if (at.live && !change.reason) return fail(NEEDS_REASON);
    const person = await staffContact(d.userId, at.site.orgId, { activeOnly: true });
    if (!person) return fail("That person is no longer active.");
    const what = `${need.typeName ?? "Staff"} on duty, ${need.areaName}`;
    const rows = await prisma.rotaAreaAssignment.findMany({ where: { siteId: d.siteId, areaId: need.areaId, date: parseDateOnly(d.date), qualificationTypeId: need.qualificationTypeId }, select: { place: true, startMinutes: true, endMinutes: true } });
    await prisma.$transaction(async (tx) => {
      const row = await tx.rotaAreaAssignment.create({ data: { orgId: at.site.orgId, siteId: d.siteId, areaId: need.areaId, date: parseDateOnly(d.date), qualificationTypeId: need.qualificationTypeId,
        place: freePlace(rows, need.places, t.start, t.end), userId: person.id, startMinutes: t.start, endMinutes: t.end, createdById: at.actor.id, createdByName: at.actor.name } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaAreaAssignment", entityId: row.id, clubId: d.siteId, summary: `Put ${person.name} on ${what}, ${d.date} ${clock(t.start)}–${clock(t.end)}` }, tx);
      if (at.live) await logLive(tx, at, d.date, "added", `${person.name} put on ${what}, ${clock(t.start)} to ${clock(t.end)}`, person.id, change);
    });
    refresh();
    if (await shared(prisma, d.siteId, d.departmentId, d.date)) await notifyShiftChange(person.id, `You are on ${what} at ${at.site.name} on ${d.date}, ${clock(t.start)}–${clock(t.end)}.`);
    return ok();
  }
  const need = await prisma.rotaNeed.findFirst({ where: { id: d.needId, siteId: d.siteId }, select: { id: true, date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true,
    repeat: { select: { title: true } }, assignments: { select: { place: true, startMinutes: true, endMinutes: true } } } });
  if (!need || iso(need.date) !== d.date) return fail("That is no longer on the day.");
  if (t.start < need.startMinutes || t.end > need.endMinutes) return fail(`Keep the time inside its own time, ${clock(need.startMinutes)} to ${clock(need.endMinutes)}.`);
  const type = await activityTypeById(need.typeId);
  const at = await allowedForPerson(d.siteId, d.date, type?.departmentId ?? d.departmentId, d.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = await staffContact(d.userId, at.site.orgId, { activeOnly: true });
  if (!person) return fail("That person is no longer active.");
  const what = `${need.repeat?.title ?? type?.name ?? "an activity"}${need.place ? `, ${need.place}` : ""}`;
  // The activity's usual sub-activities come with it (owner, 20 October 2026); one at set times
  // with the times that fall in their stretch, and only when one does.
  const usual = usualSubs(await subActivitiesFor([need.typeId], { usualOnly: true }), need.typeId, t);
  await prisma.$transaction(async (tx) => {
    const row = await tx.rotaAssignment.create({ data: { needId: need.id, place: freePlace(need.assignments, need.places, t.start, t.end), userId: person.id, startMinutes: t.start, endMinutes: t.end,
      createdById: at.actor.id, createdByName: at.actor.name,
      subs: { create: usual } } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaAssignment", entityId: row.id, clubId: d.siteId, summary: `Put ${person.name} on ${what}, ${d.date} ${clock(t.start)}–${clock(t.end)}` }, tx);
    if (at.live) await logLive(tx, at, d.date, "added", `${person.name} put on ${what}, ${clock(t.start)} to ${clock(t.end)}`, person.id, change);
  });
  refresh();
  if (type && (await shared(prisma, d.siteId, type.departmentId, d.date))) await notifyShiftChange(person.id, `You are on ${what} at ${at.site.name} on ${d.date}, ${clock(t.start)}–${clock(t.end)}.`);
  return ok();
}

/** Fill an area's activity line (owner, 21 October 2026: Reception needs at least one person on
 *  Serving customers): the person is put on that activity in the area, so their day says what
 *  they do there and the activity's usual sub-activities come with it. The day keeps one record of
 *  the activity in the area for this, asking for nobody itself, stretched to the line's hours. */
async function fillAreaActivity(d: z.output<typeof fillSchema> & { need: ReturnType<typeof areaNeedsOn>[number] & { activityTypeId: string }; t: { start: number; end: number } }, change: z.output<typeof changeSchema>): Promise<ActionResult> {
  const { need, t } = d;
  const type = await activityTypeById(need.activityTypeId);
  if (!type) return fail("That activity is no longer on the list. Check the area's staff under Admin, Areas.");
  const at = await allowedForPerson(d.siteId, d.date, d.departmentId, d.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = await staffContact(d.userId, at.site.orgId, { activeOnly: true });
  if (!person) return fail("That person is no longer active.");
  const what = `${type.name}, ${need.areaName}`;
  const usual = usualSubs(await subActivitiesFor([type.id], { usualOnly: true }), type.id, t);
  const on = parseDateOnly(d.date);
  await prisma.$transaction(async (tx) => {
    const held = await tx.rotaNeed.findFirst({ where: { siteId: d.siteId, date: on, typeId: type.id, place: need.areaName, places: 0, repeatId: null }, select: { id: true, startMinutes: true, endMinutes: true } });
    const start = Math.min(need.startMinutes, held?.startMinutes ?? need.startMinutes), end = Math.max(need.endMinutes, held?.endMinutes ?? need.endMinutes);
    const carrier = held
      ? (held.startMinutes !== start || held.endMinutes !== end ? await tx.rotaNeed.update({ where: { id: held.id }, data: { startMinutes: start, endMinutes: end } }) : held)
      : await tx.rotaNeed.create({ data: { orgId: at.site.orgId, siteId: d.siteId, date: on, typeId: type.id, place: need.areaName, startMinutes: start, endMinutes: end, places: 0,
        note: `For ${need.areaName}'s need`, createdById: at.actor.id, createdByName: at.actor.name } });
    const row = await tx.rotaAssignment.create({ data: { needId: carrier.id, place: 1, userId: person.id, startMinutes: t.start, endMinutes: t.end, createdById: at.actor.id, createdByName: at.actor.name,
      subs: { create: usual } } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaAssignment", entityId: row.id, clubId: d.siteId,
      summary: `Put ${person.name} on ${what} for the area's need, ${d.date} ${clock(t.start)}–${clock(t.end)}` }, tx);
    if (at.live) await logLive(tx, at, d.date, "added", `${person.name} put on ${what}, ${clock(t.start)} to ${clock(t.end)}`, person.id, change);
  });
  refresh();
  if (await shared(prisma, d.siteId, type.departmentId, d.date)) await notifyShiftChange(person.id, `You are on ${what} at ${at.site.name} on ${d.date}, ${clock(t.start)}–${clock(t.end)}.`);
  return ok();
}

const lineSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  departmentId: z.string().min(1),
  kind: z.enum(["area", "activity", "booking", "class"]),
  /** The saved place (area or activity), or the class's reference. */
  id: z.string().min(1),
  userId: z.string().min(1),
});
export type LineInput = z.input<typeof lineSchema>;

/** Change when someone is on something, inside its own time. */
export async function changeLine(input: LineInput & { start: string; end: string }, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const d = parsed.data;
  const t = times(input.start, input.end);
  if (!t.ok) return fail(t.error);
  if (d.kind === "class") return fail("A swim class keeps its timetable times. Change it in the swim school.");
  const at = await allowedForPerson(d.siteId, d.date, d.departmentId, d.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  if (d.kind === "area") {
    const row = await prisma.rotaAreaAssignment.findFirst({ where: { id: d.id, siteId: d.siteId, userId: d.userId }, select: { id: true, areaId: true, date: true, qualificationTypeId: true, startMinutes: true, endMinutes: true } });
    if (!row || iso(row.date) !== d.date) return fail("That is no longer on the day.");
    const need = areaNeedsOn(await areasAt(d.siteId), d.date).find((n) => n.areaId === row.areaId && n.qualificationTypeId === row.qualificationTypeId);
    if (need && (t.start < need.startMinutes || t.end > need.endMinutes)) return fail(`Keep the time inside the hours it is open, ${clock(need.startMinutes)} to ${clock(need.endMinutes)}.`);
    await prisma.$transaction(async (tx) => {
      await tx.rotaAreaAssignment.update({ where: { id: row.id }, data: { startMinutes: t.start, endMinutes: t.end } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaAreaAssignment", entityId: row.id, clubId: d.siteId,
        summary: `Changed a time on ${d.date} to ${clock(t.start)}–${clock(t.end)} (was ${clock(row.startMinutes)}–${clock(row.endMinutes)})` }, tx);
      if (at.live) await logLive(tx, at, d.date, "changed", `Time changed to ${clock(t.start)} to ${clock(t.end)}`, d.userId, change);
    });
  } else {
    const row = await prisma.rotaAssignment.findFirst({ where: { id: d.id, userId: d.userId, need: { siteId: d.siteId } },
      select: { id: true, startMinutes: true, endMinutes: true, need: { select: { id: true, date: true, startMinutes: true, endMinutes: true, places: true, repeatId: true } } } });
    if (!row || iso(row.need.date) !== d.date) return fail("That is no longer on the day.");
    // A record kept only for an area's activity line asks for nobody: it stretches with the people on it.
    const holder = row.need.places === 0 && !row.need.repeatId;
    if (!holder && (t.start < row.need.startMinutes || t.end > row.need.endMinutes)) return fail(`Keep the time inside its own time, ${clock(row.need.startMinutes)} to ${clock(row.need.endMinutes)}.`);
    await prisma.$transaction(async (tx) => {
      if (holder && (t.start < row.need.startMinutes || t.end > row.need.endMinutes)) {
        await tx.rotaNeed.update({ where: { id: row.need.id }, data: { startMinutes: Math.min(t.start, row.need.startMinutes), endMinutes: Math.max(t.end, row.need.endMinutes) } });
      }
      await tx.rotaAssignment.update({ where: { id: row.id }, data: { startMinutes: t.start, endMinutes: t.end } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaAssignment", entityId: row.id, clubId: d.siteId,
        summary: `Changed a time on ${d.date} to ${clock(t.start)}–${clock(t.end)} (was ${clock(row.startMinutes)}–${clock(row.endMinutes)})` }, tx);
      if (at.live) await logLive(tx, at, d.date, "changed", `Time changed to ${clock(t.start)} to ${clock(t.end)}`, d.userId, change);
    });
  }
  refresh();
  return ok();
}

/** Take someone off what they are on; that time needs someone again. */
export async function removeLine(input: LineInput, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = lineSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const d = parsed.data;
  if (d.kind === "class") return planTeacher({ siteId: d.siteId, date: d.date, classRef: d.id, userId: null, departmentId: d.departmentId }, change);
  const at = await allowedForPerson(d.siteId, d.date, d.departmentId, d.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = await staffContact(d.userId, at.site.orgId);
  const name = person?.name ?? "Someone";
  if (d.kind === "area") {
    const row = await prisma.rotaAreaAssignment.findFirst({ where: { id: d.id, siteId: d.siteId, userId: d.userId }, select: { id: true, date: true, startMinutes: true, endMinutes: true } });
    if (!row || iso(row.date) !== d.date) return fail("That is no longer on the day.");
    await prisma.$transaction(async (tx) => {
      await tx.rotaAreaAssignment.delete({ where: { id: row.id } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaAreaAssignment", entityId: row.id, clubId: d.siteId, summary: `Took ${name} off an area, ${d.date} ${clock(row.startMinutes)}–${clock(row.endMinutes)}` }, tx);
      if (at.live) await logLive(tx, at, d.date, "removed", `${name} taken off an area, ${clock(row.startMinutes)} to ${clock(row.endMinutes)}`, d.userId, change, d.userId);
    });
  } else {
    const row = await prisma.rotaAssignment.findFirst({ where: { id: d.id, userId: d.userId, need: { siteId: d.siteId } }, select: { id: true, startMinutes: true, endMinutes: true, need: { select: { date: true } } } });
    if (!row || iso(row.need.date) !== d.date) return fail("That is no longer on the day.");
    await prisma.$transaction(async (tx) => {
      await tx.rotaAssignment.delete({ where: { id: row.id } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaAssignment", entityId: row.id, clubId: d.siteId, summary: `Took ${name} off an activity, ${d.date} ${clock(row.startMinutes)}–${clock(row.endMinutes)}` }, tx);
      if (at.live) await logLive(tx, at, d.date, "removed", `${name} taken off an activity, ${clock(row.startMinutes)} to ${clock(row.endMinutes)}`, d.userId, change, d.userId);
    });
  }
  refresh();
  if (await shared(prisma, d.siteId, d.departmentId, d.date)) await notifyShiftChange(d.userId, `A change to your day at ${at.site.name} on ${d.date}: you are off something you were on. Check your day.`);
  return ok();
}

const shiftSchema = z.object({
  siteId: z.string().min(1),
  departmentId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  userId: z.string().min(1, "Choose who."),
  start: z.string(),
  end: z.string(),
});
export type ShiftInput = z.input<typeof shiftSchema>;

/** Put someone in for a stretch before anything is given to them, or change that stretch (`id`).
 *  Two of theirs at the site may not overlap. */
export async function saveShift(id: string | null, input: ShiftInput, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const d = parsed.data;
  const t = times(d.start, d.end);
  if (!t.ok) return fail(t.error);
  const before = id ? await prisma.rotaPlanShift.findFirst({ where: { id, siteId: d.siteId }, select: { id: true, departmentId: true, date: true, userId: true, startMinutes: true, endMinutes: true } }) : null;
  if (id && !before) return fail("That shift is no longer on the day.");
  const departmentId = before?.departmentId ?? d.departmentId, userId = before?.userId ?? d.userId, date = before ? iso(before.date) : d.date;
  const at = await allowedFor(d.siteId, date, departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const [department, person] = await Promise.all([departmentById(departmentId, at.site.orgId), staffContact(userId, at.site.orgId, { activeOnly: true })]);
  if (!department) return fail("That department no longer exists.");
  if (!person) return fail("That person is no longer active.");
  const clash = await prisma.rotaPlanShift.findFirst({ where: { userId, siteId: d.siteId, date: parseDateOnly(date), id: id ? { not: id } : undefined, startMinutes: { lt: t.end }, endMinutes: { gt: t.start } }, select: { startMinutes: true, endMinutes: true } });
  if (clash) return fail(`${person.name} is already in from ${clock(clash.startMinutes)} to ${clock(clash.endMinutes)}. Change that one instead.`);
  const summary = `${person.name} in for ${department.name}, ${date} ${clock(t.start)}–${clock(t.end)}`;
  await prisma.$transaction(async (tx) => {
    const row = before
      ? await tx.rotaPlanShift.update({ where: { id: before.id }, data: { startMinutes: t.start, endMinutes: t.end } })
      : await tx.rotaPlanShift.create({ data: { orgId: at.site.orgId, siteId: d.siteId, departmentId, date: parseDateOnly(date), userId, startMinutes: t.start, endMinutes: t.end, createdById: at.actor.id, createdByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: before ? "update" : "create", entity: "RotaPlanShift", entityId: row.id, clubId: d.siteId,
      summary: before ? `Changed ${summary} (was ${clock(before.startMinutes)}–${clock(before.endMinutes)})` : `Put ${summary}` }, tx);
    if (at.live) await logLive(tx, at, date, before ? "changed" : "added", `${person.name} ${before ? "now in" : "in"} ${clock(t.start)} to ${clock(t.end)}`, userId, change);
  });
  refresh();
  if (await shared(prisma, d.siteId, departmentId, date)) await notifyShiftChange(userId, `${before ? "Your shift changed" : "You are on a shift"} at ${at.site.name} on ${date}, ${clock(t.start)}–${clock(t.end)}.`);
  return ok();
}

/** Take a planned shift off; what they are on stays, and their day follows from it. */
export async function removeShift(id: string, siteId: string, changeInput: Change = {}): Promise<ActionResult> {
  const change = changeSchema.parse(changeInput);
  const row = await prisma.rotaPlanShift.findFirst({ where: { id, siteId }, select: { id: true, departmentId: true, date: true, userId: true, startMinutes: true, endMinutes: true } });
  if (!row) return fail("That shift is no longer on the day.");
  const date = iso(row.date);
  const at = await allowedFor(siteId, date, row.departmentId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = await staffContact(row.userId, at.site.orgId);
  await prisma.$transaction(async (tx) => {
    await tx.rotaPlanShift.delete({ where: { id } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "RotaPlanShift", entityId: id, clubId: siteId,
      summary: `Took ${person?.name ?? "someone"}'s shift off, ${date} ${clock(row.startMinutes)}–${clock(row.endMinutes)}` }, tx);
    if (at.live) await logLive(tx, at, date, "removed", `${person?.name ?? "Someone"}'s shift ${clock(row.startMinutes)} to ${clock(row.endMinutes)} taken off`, row.userId, change, row.userId);
  });
  refresh();
  if (await shared(prisma, siteId, row.departmentId, date)) await notifyShiftChange(row.userId, `Your shift at ${at.site.name} on ${date}, ${clock(row.startMinutes)}–${clock(row.endMinutes)}, is off the plan.`);
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

/** Place someone's breaks for the day (handbook: "all breaks will be allocated by the Manager on
 *  shift"), replacing the ones placed before. A break during their work leaves that time to cover. */
export async function placeBreaks(input: BreaksInput, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = breaksSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const { siteId, departmentId, date, userId } = parsed.data;
  const at = await allowedForPerson(siteId, date, departmentId, userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const person = await staffContact(userId, at.site.orgId);
  if (!person) return fail("That person is no longer here.");
  const breaks: { start: number; minutes: number; paid: boolean }[] = [];
  for (const b of parsed.data.breaks) {
    const start = parseClock(b.start);
    if (start === null || start + b.minutes > 1440) return fail("Use times like 11:30.");
    breaks.push({ start, minutes: b.minutes, paid: b.paid });
  }
  breaks.sort((a, b) => a.start - b.start);
  if (breaks.some((b, i) => i > 0 && breaks[i - 1].start + breaks[i - 1].minutes > b.start)) return fail("Two breaks overlap. Move one.");
  const on = parseDateOnly(date);
  const words = breaks.length ? breaks.map((b) => `${b.minutes} min ${b.paid ? "paid" : "unpaid"} at ${clock(b.start)}`).join(", ") : "none placed";
  await prisma.$transaction(async (tx) => {
    await tx.rotaBreak.deleteMany({ where: { siteId, date: on, userId } });
    if (breaks.length) await tx.rotaBreak.createMany({ data: breaks.map((b) => ({ orgId: at.site.orgId, siteId, date: on, userId, startMinutes: b.start, minutes: b.minutes, paid: b.paid, byId: at.actor.id, byName: at.actor.name })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaBreak", entityId: null, clubId: siteId, summary: `Placed ${person.name}'s breaks on ${date}: ${words}` }, tx);
    if (at.live) await logLive(tx, at, date, "changed", `${person.name}'s breaks: ${words}`, person.id, change);
  });
  refresh();
  return ok();
}

const subsSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  departmentId: z.string().min(1),
  /** The activity or booking place they are on. */
  id: z.string().min(1),
  userId: z.string().min(1),
  subs: z.array(z.object({ subActivityId: z.string().nullable(), name: z.string().trim().min(1).max(60), when: z.enum(["start", "end", "at", "during"]),
    /** Its times that day, like 12:00 and 16:00, when `when` is "at". */
    times: z.array(z.string()).max(12).default([]) })).max(20),
});
export type LineSubsInput = z.input<typeof subsSchema>;

/** Which sub-activities someone does while on an activity that day, and when (owner, 20 October
 *  2026: Till 1's "open the cash till" at the start, "close" at the end), replacing the ones
 *  before. One at a set time keeps inside their stretch. */
export async function saveLineSubs(input: LineSubsInput, changeInput: Change = {}): Promise<ActionResult> {
  const parsed = subsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = changeSchema.parse(changeInput);
  const d = parsed.data;
  const at = await allowedForPerson(d.siteId, d.date, d.departmentId, d.userId);
  if (!at.ok) return fail(at.error);
  if (at.live && !change.reason) return fail(NEEDS_REASON);
  const row = await prisma.rotaAssignment.findFirst({ where: { id: d.id, userId: d.userId, need: { siteId: d.siteId } }, select: { id: true, startMinutes: true, endMinutes: true, need: { select: { date: true, typeId: true } } } });
  if (!row || iso(row.need.date) !== d.date) return fail("That is no longer on the day.");
  const subs: { subActivityId: string | null; name: string; when: string; atMinutes: number | null; times: number[] }[] = [];
  for (const x of d.subs) {
    const times = x.when === "at" ? x.times.map(parseClock) : [];
    if (x.when === "at" && (!times.length || times.some((m) => m === null || m < row.startMinutes || m > row.endMinutes))) {
      return fail(`Give ${x.name} its times while they are on it, ${clock(row.startMinutes)} to ${clock(row.endMinutes)}.`);
    }
    const sorted = [...new Set(times as number[])].sort((a, b) => a - b);
    subs.push({ subActivityId: x.subActivityId, name: x.name, when: x.when, atMinutes: sorted[0] ?? null, times: sorted });
  }
  const person = await staffContact(d.userId, at.site.orgId);
  const words = subs.map((x) => (x.times.length ? `${x.name} at ${x.times.map(clock).join(" and ")}` : x.when === "during" ? x.name : `${x.name} at the ${x.when}`)).join(", ") || "none";
  await prisma.$transaction(async (tx) => {
    await tx.rotaAssignmentSub.deleteMany({ where: { assignmentId: row.id } });
    if (subs.length) await tx.rotaAssignmentSub.createMany({ data: subs.map((x, i) => ({ ...x, assignmentId: row.id, sortOrder: i })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaAssignment", entityId: row.id, clubId: d.siteId,
      summary: `Set ${person?.name ?? "someone"}'s sub-activities on ${d.date}, ${clock(row.startMinutes)}–${clock(row.endMinutes)}: ${words}` }, tx);
    if (at.live) await logLive(tx, at, d.date, "changed", `${person?.name ?? "Someone"}'s sub-activities: ${words}`, d.userId, change);
  });
  refresh();
  return ok();
}
