"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { formatDate, isDateOnly, parseDateOnly, toDateOnlyString as iso, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { activityTypeById } from "@/lib/setup/activity-types";
import { BOOKING_KINDS, addDaysIso, bookingDates, clock, parseClock, slotProblem } from "@/modules/rota/shared/constants";
import { repeatChanges } from "@/modules/rota/features/bookings/server/changes";
import { areaProblem } from "@/lib/setup/data";
import { areasAt } from "@/lib/directory";
import { laneClash, lanesFrom, lanesLabel, lanesProblem } from "@/modules/rota/shared/lanes";
import { notifyShiftChange } from "@/lib/staff-api/notify";
import { allowedFor, refresh } from "@/modules/rota/shared/writes";
import { liveSiteById } from "@/lib/directory";
import { currentActor, mayFor } from "@/lib/policy/session";
import { BOOKING_KIND_META } from "@/modules/rota/shared/constants";

/* ---------- Repeating bookings ---------- */

const repeatSchema = z.object({
  siteId: z.string().min(1),
  kind: z.enum(BOOKING_KINDS, { message: "Choose what it is." }),
  title: z.string().trim().min(2, "Say who it is for, for example the school's name.").max(80, "Keep it under 80 characters."),
  typeId: z.string().min(1, "Choose the activity it needs."),
  place: z.string().trim().max(60, "Keep the place under 60 characters."),
  start: z.string(),
  end: z.string(),
  /** 0 for a booking that needs no staff, such as lane hire (owner, 20 October 2026). */
  places: z.coerce.number().int().min(0, "Use 0 when it needs no staff.").max(20, "Up to 20 staff at once."),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7),
  firstDay: z.string().refine(isDateOnly, "Choose the first day."),
  lastDay: z.string().refine(isDateOnly, "Choose the last day."),
  skipDates: z.array(z.string().refine(isDateOnly, "Choose each date it does not run.")).max(120).default([]),
  /** The area's lanes it takes; none for the whole area (owner request, 13 October 2026). */
  lanes: z.array(z.union([z.number(), z.string()])).max(20).default([]),
});
export type RepeatInput = z.input<typeof repeatSchema>;
/** The most days one booking may make, so a typo in a date cannot fill a year. */
const MAX_DAYS = 200;

/** The checks a booking passes whether it is new or changed: its times, its activity and its area. */
async function checked(input: RepeatInput) {
  const parsed = repeatSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0].message };
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return { ok: false as const, error: "Use times like 09:30." };
  if (end <= start) return { ok: false as const, error: "It has to end after it starts." };
  const slot = slotProblem(start, end);
  if (slot) return { ok: false as const, error: slot };
  if (data.lastDay < data.firstDay) return { ok: false as const, error: "The last day can't be before the first." };
  const found = await activityTypeById(data.typeId);
  const type = found && !found.archivedAt && !found.fromClasses ? found : null;
  if (!type) return { ok: false as const, error: "That activity is no longer on the list." };
  const lanes = lanesFrom(data.lanes);
  const laneCount = (await areasAt(data.siteId)).find((a) => a.name.toLowerCase() === data.place.toLowerCase())?.lanes ?? 0;
  const laneIssue = lanesProblem(lanes, laneCount, data.place);
  if (laneIssue) return { ok: false as const, error: laneIssue };
  return { ok: true as const, data, start, end, type, lanes: laneCount ? lanes : [], laneCount };
}

/** Two bookings can't hold the same lane at the same time (owner default, 13 October 2026): the
 *  first other booking at the site that would, on a day still to come, in words; else null. */
async function laneTaken(input: { id?: string; siteId: string; title: string; place: string; lanes: number[]; laneCount: number; start: number; end: number; dates: string[] }) {
  if (!input.laneCount || !input.place || !input.dates.length) return null;
  const tomorrow = addDaysIso(today(), 1);
  const others = await prisma.rotaRepeat.findMany({
    where: { siteId: input.siteId, cancelledAt: null, place: { equals: input.place, mode: "insensitive" }, lastDay: { gte: parseDateOnly(tomorrow) }, ...(input.id ? { id: { not: input.id } } : {}) },
    select: { id: true, title: true, place: true, lanes: true, startMinutes: true, endMinutes: true, weekdays: true, firstDay: true, lastDay: true, skipDates: true },
  });
  const clash = laneClash({ ...input }, others.map((o) => {
    const first = iso(o.firstDay);
    return { id: o.id, title: o.title, place: o.place, lanes: o.lanes, start: o.startMinutes, end: o.endMinutes,
      dates: bookingDates(first > tomorrow ? first : tomorrow, iso(o.lastDay), o.weekdays, o.skipDates.map(iso)) };
  }), input.laneCount);
  if (!clash) return null;
  const o = clash.other;
  const whole = lanesLabel(o.lanes, input.laneCount) === "Whole pool";
  return `${o.title} already has ${whole ? `the whole of ${input.place}` : `${lanesLabel(o.lanes, input.laneCount).toLowerCase()} in ${input.place}`} from ${clock(o.start)} to ${clock(o.end)} on ${formatDate(parseDateOnly(clash.date))}. Choose other lanes or times.`;
}

/** A booking that repeats: it adds its activity on each of its days, each then planned and
 *  changed on its own. Only days after today are made. */
export async function saveRepeat(input: RepeatInput): Promise<ActionResult> {
  const check = await checked(input);
  if (!check.ok) return fail(check.error);
  const { data, start, end, type, lanes, laneCount } = check;
  const now = today();
  const dates = bookingDates(data.firstDay > now ? data.firstDay : addDaysIso(now, 1), data.lastDay, data.weekdays, data.skipDates);
  if (!dates.length) return fail("None of those days are still to come.");
  if (dates.length > MAX_DAYS) return fail(`That makes ${dates.length} days. Keep a booking to ${MAX_DAYS} days.`);
  const at = await allowedFor(data.siteId, dates[0], type.departmentId);
  const where = await areaProblem(data.siteId, data.place);
  if (where) return fail(where);
  if (!at.ok) return fail(at.error);
  const taken = await laneTaken({ siteId: data.siteId, title: data.title, place: data.place, lanes, laneCount, start, end, dates });
  if (taken) return fail(taken);
  await prisma.$transaction(async (tx) => {
    const repeat = await tx.rotaRepeat.create({ data: {
      orgId: at.site.orgId, siteId: at.site.id, kind: data.kind, title: data.title, typeId: type.id, place: data.place, lanes, startMinutes: start, endMinutes: end, places: data.places,
      weekdays: data.weekdays, firstDay: parseDateOnly(data.firstDay), lastDay: parseDateOnly(data.lastDay), skipDates: data.skipDates.map(parseDateOnly),
      createdById: at.actor.id, createdByName: at.actor.name,
    } });
    await tx.rotaNeed.createMany({ data: dates.map((d) => ({
      orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(d), typeId: type.id, place: data.place, lanes, startMinutes: start, endMinutes: end, places: data.places,
      repeatId: repeat.id, createdById: at.actor.id, createdByName: at.actor.name,
    })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "RotaRepeat", entityId: repeat.id, clubId: at.site.id,
      summary: `Added the booking ${data.title}: ${type.name} on ${dates.length} days from ${dates[0]}` }, tx);
  });
  refresh();
  revalidatePath("/rota/bookings");
  return ok();
}

/** Change a booking (owner request, 13 October 2026). Only its days still to come change; days
 *  that have come stay as they were, and so does its first day once it has started. Days it no
 *  longer runs leave the plan with anyone on them, new days are added, and the days it keeps take
 *  what changed, so a day changed on its own on the Plan keeps the rest. Like an activity on the
 *  Plan, its times and places shrink only past the people already on it. */
export async function editRepeat(id: string, input: RepeatInput): Promise<ActionResult> {
  const repeat = await prisma.rotaRepeat.findFirst({ where: { id, cancelledAt: null }, select: {
    siteId: true, kind: true, title: true, typeId: true, place: true, lanes: true, startMinutes: true, endMinutes: true, places: true, weekdays: true, firstDay: true, lastDay: true, skipDates: true,
  } });
  if (!repeat) return fail("That booking is cancelled.");
  if (input.siteId !== repeat.siteId) return fail("That booking is at another site.");
  const now = today(), tomorrow = addDaysIso(now, 1);
  const startedOn = iso(repeat.firstDay);
  const started = startedOn <= now;
  // Once it has started, its first day is history: it stays.
  const check = await checked(started ? { ...input, firstDay: startedOn } : input);
  if (!check.ok) return fail(check.error);
  const { data, start, end, type, lanes, laneCount } = check;
  const was = await activityTypeById(repeat.typeId);
  const from = await allowedFor(repeat.siteId, tomorrow, was?.departmentId ?? "");
  if (!from.ok) return fail(from.error);
  const at = type.id === repeat.typeId ? from : await allowedFor(data.siteId, tomorrow, type.departmentId);
  if (!at.ok) return fail(at.error);
  const where = await areaProblem(data.siteId, data.place, repeat.place);
  if (where) return fail(where);
  // Dates it was left out on that have come stay on its record; the rest are as chosen now.
  const skipDates = [...new Set([...repeat.skipDates.map(iso).filter((d) => d <= now), ...data.skipDates.filter((d) => d > now)])].sort();
  const dates = bookingDates(data.firstDay > now ? data.firstDay : tomorrow, data.lastDay, data.weekdays, skipDates);
  if (!started && !dates.length) return fail("None of those days are still to come.");
  if (dates.length > MAX_DAYS) return fail(`That makes ${dates.length} days. Keep a booking to ${MAX_DAYS} days.`);
  const taken = await laneTaken({ id, siteId: data.siteId, title: data.title, place: data.place, lanes, laneCount, start, end, dates });
  if (taken) return fail(taken);

  const future = await prisma.rotaNeed.findMany({ where: { repeatId: id, date: { gte: parseDateOnly(tomorrow) } }, orderBy: { date: "asc" },
    select: { id: true, date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true,
      assignments: { select: { userId: true, place: true, startMinutes: true, endMinutes: true } } } });
  const plan = repeatChanges(future.map((n) => ({ id: n.id, date: iso(n.date) })), dates);
  const kept = future.filter((n) => plan.keep.includes(n.id));
  const dropped = future.filter((n) => plan.drop.includes(n.id));
  // Only what changed on the booking reaches its days; times go together.
  const timesChanged = start !== repeat.startMinutes || end !== repeat.endMinutes;
  const lanesChanged = data.place !== repeat.place || lanes.join() !== repeat.lanes.join();
  const changes = {
    ...(type.id !== repeat.typeId ? { typeId: type.id } : {}),
    ...(data.place !== repeat.place ? { place: data.place } : {}),
    ...(lanesChanged ? { lanes } : {}),
    ...(timesChanged ? { startMinutes: start, endMinutes: end } : {}),
    ...(data.places !== repeat.places ? { places: data.places } : {}),
  };
  const day = (d: Date) => formatDate(d);
  for (const n of kept) {
    const places = changes.places ?? n.places, s = changes.startMinutes ?? n.startMinutes, e = changes.endMinutes ?? n.endMinutes;
    if (n.assignments.some((a) => a.place > places)) return fail(`On ${day(n.date)} someone is on a place you are removing. Take them off on the Plan first.`);
    if (n.assignments.some((a) => a.startMinutes < s || a.endMinutes > e)) return fail(`On ${day(n.date)} someone is on it outside the new times. Change their time on the Plan first.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.rotaRepeat.update({ where: { id }, data: {
      kind: data.kind, title: data.title, typeId: type.id, place: data.place, lanes, startMinutes: start, endMinutes: end, places: data.places,
      weekdays: data.weekdays, firstDay: parseDateOnly(data.firstDay), lastDay: parseDateOnly(data.lastDay), skipDates: skipDates.map(parseDateOnly),
    } });
    if (dropped.length) await tx.rotaNeed.deleteMany({ where: { id: { in: dropped.map((n) => n.id) } } });
    if (kept.length && Object.keys(changes).length) await tx.rotaNeed.updateMany({ where: { id: { in: kept.map((n) => n.id) } }, data: changes });
    if (plan.add.length) await tx.rotaNeed.createMany({ data: plan.add.map((d) => ({
      orgId: at.site.orgId, siteId: at.site.id, date: parseDateOnly(d), typeId: type.id, place: data.place, lanes, startMinutes: start, endMinutes: end, places: data.places,
      repeatId: id, createdById: at.actor.id, createdByName: at.actor.name,
    })) });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "RotaRepeat", entityId: id, clubId: at.site.id,
      summary: `Changed the booking ${data.title}: ${type.name} ${clock(start)}–${clock(end)}, ${plan.add.length} days added, ${dropped.length} removed, ${kept.length} kept` }, tx);
  });
  refresh();
  revalidatePath("/rota/bookings");
  for (const userId of [...new Set(dropped.flatMap((n) => n.assignments.map((a) => a.userId)))]) {
    const on = dropped.filter((n) => n.assignments.some((a) => a.userId === userId)).map((n) => day(n.date));
    await notifyShiftChange(userId, `${data.title} at ${at.site.name} no longer runs on ${on.join(", ")}, so you are no longer on it then.`);
  }
  if (type.id !== repeat.typeId || data.place !== repeat.place || timesChanged) {
    const gone = new Set(dropped.flatMap((n) => n.assignments.map((a) => a.userId)));
    for (const userId of [...new Set(kept.flatMap((n) => n.assignments.map((a) => a.userId)))]) {
      if (gone.has(userId)) continue;
      await notifyShiftChange(userId, `${data.title} at ${at.site.name} has changed: it is now ${type.name}${data.place ? ` in ${data.place}` : ""}, ${clock(start)} to ${clock(end)}.`);
    }
  }
  return ok();
}

/** Cancel a booking: its days still to come leave the plan, with anyone on them. */
export async function cancelRepeat(id: string): Promise<ActionResult> {
  const repeat = await prisma.rotaRepeat.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, title: true, typeId: true } });
  if (!repeat) return fail("That booking is already cancelled.");
  const tomorrow = addDaysIso(today(), 1);
  const at = await allowedFor(repeat.siteId, tomorrow, (await activityTypeById(repeat.typeId))?.departmentId ?? "");
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

/* ---------- Staff each kind of booking needs ---------- */

const kindStaffSchema = z.object({
  siteId: z.string().min(1),
  staff: z.record(z.enum(BOOKING_KINDS), z.coerce.number().int().min(0, "Use 0 when it needs no staff.").max(20, "Up to 20 staff at once.")),
});

/** How many staff each kind of booking needs (owner, 20 October 2026: a party yes, lane hire
 *  none), for the whole organisation. A new booking of a kind starts with its number; bookings
 *  already made keep theirs. For people who plan or run the rota. */
export async function saveKindStaff(input: z.input<typeof kindStaffSchema>): Promise<ActionResult> {
  const parsed = kindStaffSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const site = await liveSiteById(parsed.data.siteId);
  if (!site?.orgId) return fail("That site is not open.");
  const resource = { siteId: site.id, orgId: site.orgId };
  if (!(await mayFor("rota.plan", resource)) && !(await mayFor("rota.manage", resource))) return fail("Setting this needs the Plan level for Rota.");
  const actor = await currentActor();
  const orgId = site.orgId;
  const entries = Object.entries(parsed.data.staff) as [keyof typeof BOOKING_KIND_META, number][];
  await prisma.$transaction(async (tx) => {
    for (const [kind, staff] of entries) {
      await tx.rotaBookingKind.upsert({ where: { orgId_kind: { orgId, kind } }, create: { orgId, kind, staff, updatedByName: actor.name }, update: { staff, updatedByName: actor.name } });
    }
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaBookingKind", entityId: null, clubId: site.id,
      summary: `Staff each booking needs: ${entries.map(([k, n]) => `${BOOKING_KIND_META[k].label} ${n}`).join(", ")}` }, tx);
  });
  revalidatePath("/rota/bookings");
  return ok();
}
