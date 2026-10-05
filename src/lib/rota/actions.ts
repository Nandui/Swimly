"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { UNPAID_BREAK, ABSENCE_REASONS, SEGMENT_KINDS, segmentProblem, BOOKING_KINDS, BOOKING_MAX_PLACES, RETURN_FITS, ROTA_CHANGE_REASONS, addDaysIso, bookingDates, bookingDuty, clock, mondayOf, needsFitNote, parseClock, weekStarted, type RotaChangeReason } from "@/lib/rota/constants";
import type { Prisma } from "@/generated/prisma/client";
import { notifyShiftChange } from "@/lib/staff-api/reminders";

/** Rota writes. Each needs `rota.manage` at the shift's site (a site-scoped
 *  duty role plans only its own site). Qualification problems and
 *  double-bookings are warnings on the rota, never a refusal. Audited with the
 *  shift's own site. */

const changeSchema = z.object({
  /** Why it changed; needed once the duty's week has started. */
  reason: z.enum(["", ...ROTA_CHANGE_REASONS]).default(""),
  changeNote: z.string().trim().max(200, "Keep the note under 200 characters.").default(""),
  /** Already changed in Timepoint too. */
  timepoint: z.boolean().default(false),
});
export type ChangeInput = z.input<typeof changeSchema>;

const shiftSchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a date."),
  start: z.string(),
  end: z.string(),
  role: z.string().trim().min(2, "Say what the duty is, for example Poolside.").max(60),
  departmentId: z.string().trim().max(64).default("").transform((v) => v || null),
  requiredTypeId: z.string().trim().max(64).transform((v) => v || null),
  userId: z.string().trim().max(64).transform((v) => v || null),
  note: z.string().trim().max(300),
  /** New duties only: how many places to add at once ("2 lifeguards necessary"). */
  count: z.coerce.number().int().min(1, "Add at least one place.").max(12, "Add up to 12 places at once.").default(1),
}).and(changeSchema);
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

const NEEDS_REASON = "This week has started, so Timepoint already has it. Say why it changed.";
const iso = (date: Date) => date.toISOString().slice(0, 10);
/** "Poolside on 2026-10-08 14:00–22:00, Ava Example": what the change log keeps. */
function describe(s: { role: string; date: Date; startMinutes: number; endMinutes: number }, who: string | null) {
  return `${s.role} on ${iso(s.date)} ${clock(s.startMinutes)}–${clock(s.endMinutes)}, ${who ?? "unfilled"}`;
}
/** The absence a cover change covers: the person taken off is off that day. */
async function coveredAbsence(tx: Prisma.TransactionClient, userId: string | null, date: Date) {
  if (!userId) return null;
  const absence = await tx.rotaAbsence.findFirst({
    where: { userId, withdrawnAt: null, firstDay: { lte: date }, OR: [{ lastDay: null }, { lastDay: { gte: date } }] },
    select: { id: true },
  });
  return absence?.id ?? null;
}

/** Add or change a duty. Before its week starts the plan is a draft; after,
 *  Timepoint holds the week, so a change needs a reason and is logged with
 *  it (and goes on the personal file of each person it moves). */
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
  const person = data.userId ? await prisma.user.findFirst({ where: { id: data.userId, orgId: site.orgId, isActive: true }, select: { id: true, name: true } }) : null;
  if (data.userId && !person) return fail("That person is no longer active.");
  if (data.requiredTypeId && !(await prisma.qualificationType.findFirst({ where: { id: data.requiredTypeId, orgId: site.orgId }, select: { id: true } }))) {
    return fail("That qualification is no longer offered.");
  }
  if (data.departmentId && !(await prisma.department.findFirst({ where: { id: data.departmentId, orgId: site.orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: site.id }, { rotaShifts: { some: { siteId: site.id } } }] }, select: { id: true } }))) {
    return fail("Choose one of this site's departments.");
  }
  const values = {
    siteId: site.id, date: parseDateOnly(data.date), startMinutes: start, endMinutes: end, role: data.role,
    departmentId: data.departmentId, requiredTypeId: data.requiredTypeId, userId: data.userId, note: data.note,
  };
  if (id && data.count > 1) return fail("Change one shift at a time.");
  if (data.count > 1 && data.userId) return fail("Several places start unfilled. Leave the person empty, then fill each one.");
  const summary = `${data.role} at ${site.name} on ${data.date}, ${clock(start)}–${clock(end)}`;
  const now = today();
  let previousUserId: string | null = null;
  const result = await prisma.$transaction(async (tx) => {
    const existing = id ? await tx.rotaShift.findFirst({
      where: { id, cancelledAt: null, importId: null },
      select: { siteId: true, userId: true, date: true, startMinutes: true, endMinutes: true, role: true, departmentId: true, user: { select: { name: true } } },
    }) : null;
    if (id && !existing) return fail("That shift no longer exists, or came from the old roster upload.");
    // Moving a duty between sites needs the permission at both.
    if (existing && existing.siteId !== site.id) {
      const from = await allowedAt(existing.siteId);
      if (!from.ok) return fail(from.error);
    }
    const moved = !existing || existing.userId !== data.userId || iso(existing.date) !== data.date || existing.startMinutes !== start
      || existing.endMinutes !== end || existing.role !== data.role || existing.departmentId !== data.departmentId;
    const live = moved && (weekStarted(data.date, now) || (!!existing && weekStarted(iso(existing.date), now)));
    if (live && !data.reason) return fail(NEEDS_REASON);
    let shiftId = id;
    if (existing) {
      previousUserId = existing.userId;
      await tx.rotaShift.update({ where: { id: id! }, data: values });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: id!, clubId: site.id, summary: `Changed ${summary}` }, tx);
    } else {
      const created = await tx.rotaShift.create({ data: { ...values, orgId: site.orgId!, createdById: actor.id, createdByName: actor.name } });
      shiftId = created.id;
      // More places for the same duty, all unfilled ("2 lifeguards necessary").
      if (data.count > 1) await tx.rotaShift.createMany({ data: Array.from({ length: data.count - 1 }, () => ({ ...values, orgId: site.orgId!, createdById: actor.id, createdByName: actor.name })) });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaShift", entityId: created.id, clubId: site.id, summary: `Added ${data.count > 1 ? `${data.count} places: ` : ""}${summary}` }, tx);
    }
    if (live && data.reason) {
      const fromUserId = existing && existing.userId !== data.userId ? existing.userId : null;
      await tx.rotaShiftChange.create({ data: {
        orgId: site.orgId!, shiftId: shiftId!, siteId: site.id, date: values.date, kind: existing ? "changed" : "added",
        before: existing ? describe(existing, existing.user?.name ?? null) : "", after: describe(values, person?.name ?? null),
        fromUserId, toUserId: data.userId, reason: data.reason,
        absenceId: data.reason === "cover" && existing ? await coveredAbsence(tx, existing.userId, existing.date) : null,
        note: data.changeNote, byId: actor.id, byName: actor.name,
        ...(data.timepoint ? { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } : {}),
      } });
    }
    return ok();
  });
  if (result.ok) {
    revalidatePath("/rota");
    revalidatePath("/rota/day");
    // Tell the people whose duties changed (Turnfin Me email, if they want it).
    await notifyShiftChange(data.userId, `${id ? "Your shift changed" : "You have a new shift"}: ${summary}.`);
    if (previousUserId && previousUserId !== data.userId) await notifyShiftChange(previousUserId, `You are no longer on this shift: ${summary}.`);
  }
  return result;
}

export async function cancelShift(id: string, input: ChangeInput = {}): Promise<ActionResult> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = parsed.data;
  const shift = await prisma.rotaShift.findFirst({
    where: { id, cancelledAt: null }, select: { siteId: true, orgId: true, role: true, date: true, startMinutes: true, endMinutes: true, userId: true, user: { select: { name: true } } },
  });
  if (!shift) return fail("That shift no longer exists.");
  const live = weekStarted(iso(shift.date), today());
  if (live && !change.reason) return fail(NEEDS_REASON);
  const allowed = await allowedAt(shift.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.rotaShift.updateMany({ where: { id, cancelledAt: null }, data: { cancelledAt: new Date() } });
    if (moved.count !== 1) return fail("That shift is already cancelled.");
    if (live && change.reason) {
      await tx.rotaShiftChange.create({ data: {
        orgId: shift.orgId, shiftId: id, siteId: shift.siteId, date: shift.date, kind: "cancelled",
        before: describe(shift, shift.user?.name ?? null), fromUserId: shift.userId, reason: change.reason,
        absenceId: change.reason === "cover" ? await coveredAbsence(tx, shift.userId, shift.date) : null,
        note: change.changeNote, byId: actor.id, byName: actor.name,
        ...(change.timepoint ? { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } : {}),
      } });
    }
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "RotaShift", entityId: id, clubId: site.id, summary: `Cancelled ${shift.role} at ${site.name} on ${iso(shift.date)}` }, tx);
    return ok();
  });
  if (result.ok) {
    revalidatePath("/rota");
    revalidatePath("/rota/day");
    await notifyShiftChange(shift.userId, `Your shift was cancelled: ${shift.role} at ${site.name} on ${iso(shift.date)}, ${clock(shift.startMinutes)}–${clock(shift.endMinutes)}.`);
  }
  return result;
}

const copySchema = z.object({
  siteId: z.string().min(1),
  /** The first day copied from: a Monday for a whole week, else the day. */
  from: z.string().refine(isDateOnly, "Choose what to copy from."),
  /** The first day copied into: a Monday for a whole week, else the day. */
  to: z.string().refine(isDateOnly, "Choose where to copy to."),
  whole: z.boolean(),
  /** The same people, or the shape only, with every duty unfilled. */
  people: z.boolean(),
});
export type CopyPlanInput = z.input<typeof copySchema>;

/** Copies a plan from any earlier week or day, so supervisors start a day
 *  from one that worked and change what is different: duties (with the same
 *  people or unfilled), the activities and breaks inside them, the activities
 *  to cover and the day's note. Only days with nothing planned yet are
 *  filled, so a copy never doubles or overwrites a plan, and only in weeks
 *  that have not started. Booking places come from their bookings, not copies. */
export async function copyPlan(input: CopyPlanInput): Promise<ActionResult> {
  const parsed = copySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { siteId, from, to, whole, people } = parsed.data;
  if (whole && (mondayOf(from) !== from || mondayOf(to) !== to)) return fail("Choose whole weeks, Monday to Sunday.");
  if (from === to) return fail("Choose a different week or day to copy from.");
  const span = whole ? 7 : 1;
  const targets = Array.from({ length: span }, (_, i) => addDaysIso(to, i));
  if (weekStarted(targets[0], today())) return fail("That week has started. Change its duties one at a time, with a reason.");
  const allowed = await allowedAt(siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  if (!site.orgId) return fail("That site is not set up for the rota.");
  const range = (start: string) => ({ gte: parseDateOnly(start), lte: parseDateOnly(addDaysIso(start, span - 1)) });
  const [source, planned, activities, plannedActivities, notes, plannedNotes] = await Promise.all([
    prisma.rotaShift.findMany({
      where: { siteId, kind: "shift", cancelledAt: null, importId: null, bookingId: null, date: range(from) },
      select: { date: true, startMinutes: true, endMinutes: true, role: true, departmentId: true, requiredTypeId: true, userId: true, note: true,
        segments: { select: { startMinutes: true, endMinutes: true, kind: true, label: true } } },
    }),
    prisma.rotaShift.findMany({ where: { siteId, kind: "shift", cancelledAt: null, bookingId: null, date: range(to) }, select: { date: true } }),
    prisma.rotaActivity.findMany({ where: { siteId, date: range(from) }, select: { date: true, label: true, startMinutes: true, endMinutes: true, people: true, requiredTypeId: true, departmentId: true, note: true } }),
    prisma.rotaActivity.findMany({ where: { siteId, date: range(to) }, select: { date: true } }),
    prisma.rotaDayNote.findMany({ where: { siteId, date: range(from) }, select: { date: true, text: true } }),
    prisma.rotaDayNote.findMany({ where: { siteId, date: range(to) }, select: { date: true } }),
  ]);
  // Day n of the source lands on day n of the target; a day that already has a plan is left alone.
  const offset = (d: Date) => Math.round((Date.parse(iso(d)) - Date.parse(from)) / 86_400_000);
  const busy = new Set([...planned, ...plannedActivities].map((s) => iso(s.date)));
  const onto = (d: Date) => { const target = addDaysIso(to, offset(d)); return busy.has(target) ? null : target; };
  const shifts = source.flatMap((s) => { const date = onto(s.date); return date ? [{ ...s, date }] : []; });
  const covers = activities.flatMap((a) => { const date = onto(a.date); return date ? [{ ...a, date }] : []; });
  const kept = notes.flatMap((n) => { const date = addDaysIso(to, offset(n.date)); return plannedNotes.some((p) => iso(p.date) === date) ? [] : [{ ...n, date }]; });
  const skipped = [...new Set(source.concat().map((s) => addDaysIso(to, offset(s.date))).filter((d) => busy.has(d)))].length;
  if (!shifts.length && !covers.length) {
    return fail(source.length || activities.length ? "Every day there already has a plan. Clear a day first to copy onto it." : "Nothing is planned there to copy.");
  }
  await prisma.$transaction(async (tx) => {
    for (const s of shifts) {
      await tx.rotaShift.create({ data: {
        orgId: site.orgId!, siteId, date: parseDateOnly(s.date), startMinutes: s.startMinutes, endMinutes: s.endMinutes, role: s.role,
        departmentId: s.departmentId, requiredTypeId: s.requiredTypeId, userId: people ? s.userId : null, note: s.note,
        createdById: actor.id, createdByName: actor.name,
        segments: { create: s.segments.map((g) => ({ startMinutes: g.startMinutes, endMinutes: g.endMinutes, kind: g.kind, label: g.label })) },
      } });
    }
    if (covers.length) await tx.rotaActivity.createMany({ data: covers.map((a) => ({ ...a, date: parseDateOnly(a.date), orgId: site.orgId!, siteId, createdById: actor.id, createdByName: actor.name })) });
    for (const n of kept) await tx.rotaDayNote.create({ data: { orgId: site.orgId!, siteId, date: parseDateOnly(n.date), text: n.text, byId: actor.id, byName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaShift", entityId: null, clubId: site.id,
      summary: `Copied the plan of ${whole ? `the week of ${from}` : from} into ${whole ? `the week of ${to}` : to} at ${site.name}: ${shifts.length} ${shifts.length === 1 ? "duty" : "duties"}${people ? "" : ", unfilled"}, ${covers.length} ${covers.length === 1 ? "activity" : "activities"} to cover${skipped ? `; ${skipped} ${skipped === 1 ? "day" : "days"} already planned left as they were` : ""}` }, tx);
  });
  revalidatePath("/rota");
  revalidatePath("/rota/day");
  return ok();
}

const segmentSchema = z.object({
  start: z.string(),
  end: z.string(),
  kind: z.enum(SEGMENT_KINDS),
  label: z.string().trim().max(60, "Keep each activity under 60 characters."),
});
export type SegmentInput = z.input<typeof segmentSchema>;

/** What someone does during their shift: its activities and breaks, saved
 *  together (replacing the ones before). Inside the shift, never overlapping.
 *  Timepoint holds shift times, not activities, so this never asks for a
 *  reason. Needs `rota.manage` at the shift's site; audited with the site. */
export async function saveSegments(shiftId: string, input: SegmentInput[]): Promise<ActionResult> {
  const parsed = z.array(segmentSchema).max(24, "Up to 24 activities and breaks a shift.").safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const segments = parsed.data.map((s) => ({ startMinutes: parseClock(s.start), endMinutes: parseClock(s.end), kind: s.kind, label: s.kind === "break" ? s.label || UNPAID_BREAK : s.label }));
  if (segments.some((s) => s.startMinutes === null || s.endMinutes === null)) return fail("Use times like 10:30.");
  const shift = await prisma.rotaShift.findFirst({ where: { id: shiftId, cancelledAt: null, kind: "shift" }, select: { siteId: true, date: true, role: true, startMinutes: true, endMinutes: true, user: { select: { name: true } }, rotaPerson: { select: { name: true } } } });
  if (!shift) return fail("That shift no longer exists.");
  const clean = segments as { startMinutes: number; endMinutes: number; kind: "activity" | "break"; label: string }[];
  const problem = segmentProblem(shift, clean);
  if (problem) return fail(problem);
  const allowed = await allowedAt(shift.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  const who = shift.user?.name ?? shift.rotaPerson?.name ?? "the unfilled duty";
  await prisma.$transaction(async (tx) => {
    await tx.rotaShiftSegment.deleteMany({ where: { shiftId } });
    if (clean.length) await tx.rotaShiftSegment.createMany({ data: clean.map((s) => ({ shiftId, ...s })) });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: shiftId, clubId: site.id,
      summary: `Planned ${who}'s ${shift.role} on ${iso(shift.date)}: ${clean.length ? clean.sort((a, b) => a.startMinutes - b.startMinutes).map((s) => `${clock(s.startMinutes)}–${clock(s.endMinutes)} ${s.label}`).join(", ") : "no activities"}` }, tx);
  });
  revalidatePath("/rota");
  revalidatePath("/rota/day");
  return ok();
}

const activitySchema = z.object({
  siteId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a day."),
  label: z.string().trim().min(2, "Say what the activity is, for example 25m pool lifeguard.").max(60),
  start: z.string(),
  end: z.string(),
  people: z.coerce.number().int().min(1, "At least one person.").max(20, "Up to 20 people at once."),
  requiredTypeId: z.string().trim().max(64).transform((v) => v || null),
  /** The department that plans it; empty for one the whole site shares. */
  departmentId: z.string().trim().max(64).default("").transform((v) => v || null),
  note: z.string().trim().max(200),
  /** New ones only: also plan it on the days after this one to Sunday. */
  restOfWeek: z.boolean().default(false),
});
export type ActivityInput = z.input<typeof activitySchema>;

/** Plan something the site needs covered during a day (25m pool lifeguard,
 *  06:30–21:30, one at a time, holding a pool lifeguard qualification), or
 *  change one. People cover it from inside their shifts. Needs `rota.manage`
 *  at the site; audited with the site. */
export async function saveActivity(id: string | null, input: ActivityInput): Promise<ActionResult> {
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 06:30.");
  if (end <= start) return fail("The activity has to end after it starts, on the same day.");
  const allowed = await allowedAt(data.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  if (!site.orgId) return fail("That site is not set up for the rota.");
  if (data.requiredTypeId && !(await prisma.qualificationType.findFirst({ where: { id: data.requiredTypeId, orgId: site.orgId }, select: { id: true } }))) return fail("That qualification is no longer offered.");
  if (data.departmentId && !(await prisma.department.findFirst({ where: { id: data.departmentId, orgId: site.orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: site.id }, { rotaShifts: { some: { siteId: site.id } } }] }, select: { id: true } }))) return fail("That department is not at this site.");
  const values = { label: data.label, startMinutes: start, endMinutes: end, people: data.people, requiredTypeId: data.requiredTypeId, departmentId: data.departmentId, note: data.note };
  const days = id || !data.restOfWeek ? [data.date] : Array.from({ length: 7 }, (_, i) => addDaysIso(data.date, i)).filter((d) => mondayOf(d) === mondayOf(data.date));
  const result = await prisma.$transaction(async (tx) => {
    if (id) {
      const moved = await tx.rotaActivity.updateMany({ where: { id, siteId: site.id }, data: values });
      if (moved.count !== 1) return fail("That activity is no longer on the plan.");
    } else {
      await tx.rotaActivity.createMany({ data: days.map((d) => ({ ...values, orgId: site.orgId!, siteId: site.id, date: parseDateOnly(d), createdById: actor.id, createdByName: actor.name })) });
    }
    await logAudit({ actorId: actor.id, actorName: actor.name, action: id ? "update" : "create", entity: "RotaActivity", entityId: id, clubId: site.id,
      summary: `${id ? "Changed" : "Planned"} ${data.label} at ${site.name}, ${clock(start)}–${clock(end)}, ${data.people} at a time, ${days.length === 1 ? `on ${data.date}` : `${data.date} to ${days.at(-1)}`}` }, tx);
    return ok();
  });
  if (result.ok) { revalidatePath("/rota"); revalidatePath("/rota/day"); }
  return result;
}

/** Take an activity off the day's plan. People's time on it stays in their shifts. */
export async function removeActivity(id: string): Promise<ActionResult> {
  const activity = await prisma.rotaActivity.findFirst({ where: { id }, select: { siteId: true, label: true, date: true } });
  if (!activity) return ok();
  const allowed = await allowedAt(activity.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  await prisma.$transaction(async (tx) => {
    await tx.rotaActivity.delete({ where: { id } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "RotaActivity", entityId: id, clubId: site.id, summary: `Took ${activity.label} off the plan at ${site.name} on ${iso(activity.date)}` }, tx);
  });
  revalidatePath("/rota/day");
  return ok();
}

/** Put someone on an activity: it becomes that stretch of their shift. It
 *  must fit inside the shift and not overlap what they already do there; a
 *  missing qualification is shown on the plan, never a refusal. */
export async function assignActivity(input: { shiftId: string; label: string; start: string; end: string; kind?: "activity" | "break" }): Promise<ActionResult> {
  const start = parseClock(input.start), end = parseClock(input.end);
  // A break inside the shift (the day planner's "Break"), or an activity.
  const kind = input.kind === "break" ? "break" : "activity";
  const label = input.label.trim() || (kind === "break" ? UNPAID_BREAK : "");
  if (start === null || end === null) return fail("Use times like 10:30.");
  if (label.length < 2 || label.length > 60) return fail("Say what the activity is.");
  const shift = await prisma.rotaShift.findFirst({
    where: { id: input.shiftId, cancelledAt: null, kind: "shift", importId: null },
    select: { siteId: true, date: true, role: true, startMinutes: true, endMinutes: true, user: { select: { name: true } }, rotaPerson: { select: { name: true } },
      segments: { select: { startMinutes: true, endMinutes: true, kind: true, label: true } } },
  });
  if (!shift) return fail("That shift is no longer on the plan.");
  const all = [...shift.segments, { startMinutes: start, endMinutes: end, kind, label }];
  const problem = segmentProblem(shift, all);
  if (problem) return fail(problem);
  const allowed = await allowedAt(shift.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  const who = shift.user?.name ?? shift.rotaPerson?.name ?? "the unfilled duty";
  await prisma.$transaction(async (tx) => {
    await tx.rotaShiftSegment.create({ data: { shiftId: input.shiftId, startMinutes: start, endMinutes: end, kind, label } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: input.shiftId, clubId: site.id,
      summary: `Put ${who} on ${label} ${clock(start)}–${clock(end)} on ${iso(shift.date)}` }, tx);
  });
  revalidatePath("/rota/day");
  return ok();
}

/** The day's note on the plan (a last day, who covers whom and why). Empty text
 *  removes it. Needs `rota.manage` at the site; audited with the site. */
export async function saveDayNote(siteId: string, date: string, text: string): Promise<ActionResult> {
  if (!isDateOnly(date)) return fail("Choose a day.");
  const clean = text.trim();
  if (clean.length > 1000) return fail("Keep the note under 1,000 characters.");
  const allowed = await allowedAt(siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  if (!site.orgId) return fail("That site is not set up for the rota.");
  const day = parseDateOnly(date);
  await prisma.$transaction(async (tx) => {
    if (clean) await tx.rotaDayNote.upsert({ where: { siteId_date: { siteId, date: day } }, create: { orgId: site.orgId!, siteId, date: day, text: clean, byId: actor.id, byName: actor.name }, update: { text: clean, byId: actor.id, byName: actor.name } });
    else await tx.rotaDayNote.deleteMany({ where: { siteId, date: day } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaDayNote", entityId: null, clubId: site.id, summary: `${clean ? "Wrote" : "Cleared"} the rota note for ${date} at ${site.name}` }, tx);
  });
  revalidatePath("/rota");
  return ok();
}

/** The change is in Timepoint too. Closes its "Update Timepoint" follow-up. */
export async function markTimepointUpdated(changeId: string): Promise<ActionResult> {
  const change = await prisma.rotaShiftChange.findFirst({ where: { id: changeId }, select: { siteId: true, timepointAt: true, after: true, before: true } });
  if (!change) return fail("That change no longer exists.");
  if (change.timepointAt) return ok();
  const allowed = await allowedAt(change.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  await prisma.$transaction(async (tx) => {
    await tx.rotaShiftChange.update({ where: { id: changeId }, data: { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: null, clubId: site.id, summary: `Recorded a rota change as updated in Timepoint: ${change.after || change.before}` }, tx);
  });
  revalidatePath("/rota/day");
  return ok();
}

/* Bookings: school lessons, parties, lane hire, events. Saving one creates an
   unfilled duty for each place at each session; supervisors plan who on the
   week plan. Filling a place in a started week asks for its reason like any
   other change. */

const bookingSchema = z.object({
  siteId: z.string().min(1),
  kind: z.enum(BOOKING_KINDS, { message: "Choose what it is." }),
  title: z.string().trim().min(2, "Say who it is for, for example the school's name.").max(80, "Keep it under 80 characters."),
  place: z.string().trim().max(60, "Keep the place under 60 characters."),
  departmentId: z.string().trim().max(64).default("").transform((v) => v || null),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, "Choose at least one day.").max(7),
  start: z.string(),
  end: z.string(),
  firstDay: z.string().refine(isDateOnly, "Choose the first day."),
  lastDay: z.string().refine(isDateOnly, "Choose the last day."),
  /** Dates in the range it does not run. */
  skipDates: z.array(z.string().refine(isDateOnly, "Choose each date it does not run.")).max(120).default([]),
  needs: z.array(z.object({
    role: z.string().trim().min(2, "Name each role, for example Swim teacher.").max(40),
    count: z.number().int().min(1, "Each role needs at least one person.").max(20, "Up to 20 people for one role."),
    requiredTypeId: z.string().trim().max(64).default("").transform((v) => v || null),
  })).min(1, "Say who it needs.").max(8),
  note: z.string().trim().max(300),
});
export type BookingInput = z.input<typeof bookingSchema>;

export async function saveBooking(input: BookingInput): Promise<ActionResult> {
  const parsed = bookingSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const start = parseClock(data.start), end = parseClock(data.end);
  if (start === null || end === null) return fail("Use times like 09:30.");
  if (end <= start) return fail("It has to end after it starts, on the same day.");
  if (data.lastDay < data.firstDay) return fail("The last day can't be before the first.");
  if (data.firstDay < today()) return fail("A booking starts today or later.");
  const skipDates = [...new Set(data.skipDates)].filter((d) => d >= data.firstDay && d <= data.lastDay).sort();
  const dates = bookingDates(data.firstDay, data.lastDay, data.weekdays, skipDates);
  if (!dates.length) return fail("None of those days fall between the first and last day, once the dates it does not run are left out.");
  const places = dates.length * data.needs.reduce((n, need) => n + need.count, 0);
  if (places > BOOKING_MAX_PLACES) return fail(`That makes ${places} places to fill. Split it into shorter bookings, up to ${BOOKING_MAX_PLACES} places each.`);
  const allowed = await allowedAt(data.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  if (!site.orgId) return fail("That site is not set up for the rota.");
  if (data.departmentId && !(await prisma.department.findFirst({ where: { id: data.departmentId, orgId: site.orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: site.id }, { rotaShifts: { some: { siteId: site.id } } }] }, select: { id: true } }))) {
    return fail("Choose one of this site's departments.");
  }
  const types = [...new Set(data.needs.flatMap((n) => (n.requiredTypeId ? [n.requiredTypeId] : [])))];
  if (types.length && (await prisma.qualificationType.count({ where: { id: { in: types }, orgId: site.orgId } })) !== types.length) {
    return fail("One of those qualifications is no longer offered.");
  }
  const duty = bookingDuty(data.kind, data.title);
  await prisma.$transaction(async (tx) => {
    const booking = await tx.rotaBooking.create({ data: {
      orgId: site.orgId!, siteId: site.id, departmentId: data.departmentId, kind: data.kind, title: data.title, place: data.place,
      weekdays: [...new Set(data.weekdays)].sort(), startMinutes: start, endMinutes: end,
      firstDay: parseDateOnly(data.firstDay), lastDay: parseDateOnly(data.lastDay), skipDates: skipDates.map(parseDateOnly), note: data.note,
      createdById: actor.id, createdByName: actor.name,
      needs: { create: data.needs.map((n) => ({ role: n.role, count: n.count, requiredTypeId: n.requiredTypeId })) },
    }, select: { id: true, needs: { select: { id: true, role: true, count: true, requiredTypeId: true } } } });
    await tx.rotaShift.createMany({ data: dates.flatMap((date) => booking.needs.flatMap((need) => Array.from({ length: need.count }, () => ({
      orgId: site.orgId!, siteId: site.id, date: parseDateOnly(date), startMinutes: start, endMinutes: end, role: duty,
      departmentId: data.departmentId, requiredTypeId: need.requiredTypeId, userId: null, note: data.place,
      bookingId: booking.id, bookingNeedId: need.id, createdById: actor.id, createdByName: actor.name,
    })))) });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaShift", entityId: booking.id, clubId: site.id,
      summary: `Booked ${duty} at ${site.name}, ${dates.length} ${dates.length === 1 ? "session" : "sessions"} from ${data.firstDay} to ${data.lastDay}${skipDates.length ? ` except ${skipDates.join(", ")}` : ""}, ${places} places to fill` }, tx);
  });
  revalidatePath("/rota");
  revalidatePath("/rota/bookings");
  revalidatePath("/rota/day");
  return ok();
}

/** Cancels a booking's sessions still to come. People already on one in a
 *  started week are taken off with the reason given, as any change is. */
export async function cancelBooking(id: string, input: ChangeInput = {}): Promise<ActionResult> {
  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const change = parsed.data;
  const booking = await prisma.rotaBooking.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, orgId: true, kind: true, title: true } });
  if (!booking) return fail("That booking is already cancelled.");
  const allowed = await allowedAt(booking.siteId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, site } = allowed;
  const now = today();
  const ahead = await prisma.rotaShift.findMany({
    where: { bookingId: id, cancelledAt: null, date: { gte: parseDateOnly(now) } },
    select: { id: true, date: true, role: true, startMinutes: true, endMinutes: true, userId: true, user: { select: { name: true } } },
  });
  const live = ahead.filter((s) => s.userId && weekStarted(iso(s.date), now));
  if (live.length && !change.reason) return fail(`${live.length} ${live.length === 1 ? "place this week has someone" : "places this week have people"} on it. Say why it is cancelled.`);
  await prisma.$transaction(async (tx) => {
    await tx.rotaBooking.update({ where: { id }, data: { cancelledAt: new Date() } });
    await tx.rotaShift.updateMany({ where: { id: { in: ahead.map((s) => s.id) } }, data: { cancelledAt: new Date() } });
    if (live.length && change.reason) {
      await tx.rotaShiftChange.createMany({ data: live.map((s) => ({
        orgId: booking.orgId, shiftId: s.id, siteId: booking.siteId, date: s.date, kind: "cancelled", before: describe(s, s.user?.name ?? null),
        fromUserId: s.userId, reason: change.reason as RotaChangeReason, note: change.changeNote, byId: actor.id, byName: actor.name,
        ...(change.timepoint ? { timepointAt: new Date(), timepointById: actor.id, timepointByName: actor.name } : {}),
      })) });
    }
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "RotaShift", entityId: id, clubId: site.id,
      summary: `Cancelled the booking ${bookingDuty(booking.kind, booking.title)} at ${site.name}, ${ahead.length} places still to come` }, tx);
  });
  revalidatePath("/rota");
  revalidatePath("/rota/bookings");
  revalidatePath("/rota/day");
  for (const s of live) await notifyShiftChange(s.userId, `Your shift was cancelled: ${s.role} at ${site.name} on ${iso(s.date)}, ${clock(s.startMinutes)}–${clock(s.endMinutes)}.`);
  return ok();
}

/* Absences. Recording one needs `rota.manage` over that person: a site-scoped
   planner records absences only for people who work at their site. The shared
   log names the person and the days, never the reason. */

const absenceSchema = z.object({
  /** "p:<roster entry>", "u:<account>", or a bare account id. */
  userId: z.string().trim().min(1, "Choose who is off."),
  reason: z.enum(ABSENCE_REASONS, { message: "Choose a reason." }),
  firstDay: z.string().refine(isDateOnly, "Choose the first day off."),
  lastDay: z.string().trim().refine((v) => v === "" || isDateOnly(v), "Use a date for the last day, or leave it empty.").transform((v) => v || null),
  note: z.string().trim().max(200, "Keep the note under 200 characters."),
  /** Off again soon after an earlier absence, and it is the same thing: that absence. */
  continuesId: z.string().trim().max(64).optional().transform((v) => v || null),
});
export type AbsenceInput = z.input<typeof absenceSchema>;

type Person = { name: string; orgId: string; isActive: boolean; userId: string | null; rotaPersonId: string | null };
const NOT_COVERED = "You can only record absences for people at the sites your role covers.";

/** Who an absence is for, and whether this manager may record it. Someone
 *  with an account is covered as before (their sites and team). Someone on
 *  the roster without one is covered where they have been rostered lately. */
async function allowedFor(ref: { userId?: string | null; rotaPersonId?: string | null }) {
  let person: Person | null = null;
  if (ref.rotaPersonId) {
    const entry = await prisma.rotaPerson.findFirst({ where: { id: ref.rotaPersonId }, select: { id: true, name: true, orgId: true, userId: true, user: { select: { isActive: true } } } });
    if (entry) person = { name: entry.name, orgId: entry.orgId, isActive: entry.user?.isActive ?? true, userId: entry.userId, rotaPersonId: entry.id };
  } else if (ref.userId) {
    const user = await prisma.user.findFirst({ where: { id: ref.userId }, select: { id: true, name: true, orgId: true, isActive: true, rotaPerson: { select: { id: true } } } });
    if (user?.orgId) person = { name: user.name, orgId: user.orgId, isActive: user.isActive, userId: user.id, rotaPersonId: user.rotaPerson?.id ?? null };
  }
  if (!person) return { ok: false as const, error: "That person is not on the rota." };
  try {
    if (person.userId) {
      const actor = await requireCapFor("rota.manage", { subjectUserId: person.userId, orgId: person.orgId });
      return { ok: true as const, actor, person };
    }
    const sites = await prisma.rotaShift.findMany({
      where: { rotaPersonId: person.rotaPersonId!, date: { gte: parseDateOnly(addDaysIso(today(), -56)) } },
      distinct: ["siteId"], select: { siteId: true },
    });
    for (const { siteId } of sites) {
      try { return { ok: true as const, actor: await requireCapFor("rota.manage", { siteId, orgId: person.orgId }), person }; }
      catch (error) { if (!(error instanceof AuthorizationError)) throw error; }
    }
    return { ok: false as const, error: NOT_COVERED };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, error: NOT_COVERED };
    throw error;
  }
}

/** "p:<id>" is a roster entry, "u:<id>" or a bare id an account. */
function refOf(value: string) {
  if (value.startsWith("p:")) return { rotaPersonId: value.slice(2) };
  return { userId: value.startsWith("u:") ? value.slice(2) : value };
}

const days = (first: string, last: string | null) => last ? (last === first ? `on ${first}` : `from ${first} to ${last}`) : `from ${first}`;
function revalidateRota() { revalidatePath("/rota"); revalidatePath("/rota/absences"); }

export async function reportAbsence(input: AbsenceInput): Promise<ActionResult> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { userId, reason, firstDay, lastDay, note, continuesId } = parsed.data;
  if (lastDay && lastDay < firstDay) return fail("The last day off can't be before the first.");
  const allowed = await allowedFor(refOf(userId));
  if (!allowed.ok) return fail(allowed.error);
  const { actor, person } = allowed;
  if (!person.isActive) return fail("That person is no longer active.");
  const samePersonWhere = { OR: [...(person.userId ? [{ userId: person.userId }] : []), ...(person.rotaPersonId ? [{ rotaPersonId: person.rotaPersonId }] : [])] };
  return prisma.$transaction(async (tx) => {
    // One absence at a time: a second one over the same days is a mistake.
    const clash = await tx.rotaAbsence.findFirst({
      where: { ...samePersonWhere, withdrawnAt: null, firstDay: { lte: parseDateOnly(lastDay ?? "9999-12-31") }, AND: [{ OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(firstDay) } }] }] },
      select: { id: true },
    });
    if (clash) return fail(`${person.name} is already recorded as off on some of those days. Extend that absence instead.`);
    // "Same thing again" links to one of their own earlier absences that ended before this one.
    const earlier = continuesId ? await tx.rotaAbsence.findFirst({ where: { id: continuesId, ...samePersonWhere, withdrawnAt: null, lastDay: { lt: parseDateOnly(firstDay) } }, select: { id: true, firstDay: true } }) : null;
    if (continuesId && !earlier) return fail("The earlier absence to link to is not theirs, or has not ended.");
    const created = await tx.rotaAbsence.create({ data: { orgId: person.orgId, userId: person.userId, rotaPersonId: person.rotaPersonId, reason, firstDay: parseDateOnly(firstDay), lastDay: lastDay ? parseDateOnly(lastDay) : null, note, reportedById: actor.id, reportedByName: actor.name, continuesId: earlier?.id ?? null } });
    await tx.rotaAbsenceUpdate.create({ data: { absenceId: created.id, kind: "reported", lastDay: created.lastDay, note, byId: actor.id, byName: actor.name } });
    const again = earlier ? `, off again after an absence from ${earlier.firstDay.toISOString().slice(0, 10)}` : "";
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaAbsence", entityId: created.id, clubId: null, summary: `Recorded ${person.name} as off ${days(firstDay, lastDay)}${again}` }, tx);
    return ok();
  }).then((result) => { if (result.ok) revalidateRota(); return result; });
}

async function absenceFor(id: string) {
  const absence = await prisma.rotaAbsence.findFirst({ where: { id, withdrawnAt: null }, select: { id: true, userId: true, rotaPersonId: true, reason: true, firstDay: true, lastDay: true, returnMetOn: true } });
  if (!absence) return { ok: false as const, error: "That absence no longer exists." };
  const allowed = await allowedFor(absence.rotaPersonId ? { rotaPersonId: absence.rotaPersonId } : { userId: absence.userId });
  return allowed.ok ? { ...allowed, absence } : allowed;
}

const RETURN_RECORDED = "Their return to work is already recorded. If they are off again, report a new absence.";

/** They are back: the last day off is set, and the rota stops warning after it. */
export async function endAbsence(id: string, lastDay: string): Promise<ActionResult> {
  if (!isDateOnly(lastDay)) return fail("Choose their last day off.");
  const found = await absenceFor(id);
  if (!found.ok) return fail(found.error);
  const { actor, person, absence } = found;
  if (absence.returnMetOn) return fail(RETURN_RECORDED);
  const first = absence.firstDay.toISOString().slice(0, 10);
  if (lastDay < first) return fail(`Their absence started on ${first}, so the last day off can't be before it.`);
  const result = await prisma.$transaction(async (tx) => {
    await tx.rotaAbsence.update({ where: { id }, data: { lastDay: parseDateOnly(lastDay) } });
    await tx.rotaAbsenceUpdate.create({ data: { absenceId: id, kind: "back", lastDay: parseDateOnly(lastDay), byId: actor.id, byName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaAbsence", entityId: id, clubId: null, summary: `Recorded ${person.name} as back after ${lastDay}` }, tx);
    return ok();
  });
  if (result.ok) revalidateRota();
  return result;
}

/** Still off: the absence runs on to a later last day, or with no last day
 *  when the return is not known yet. The same absence, not a new one, so it
 *  counts once; each extension is kept in its story. A manager can extend an
 *  absence that has ended only up to the day before, so it runs on unbroken. */
export async function extendAbsence(id: string, input: { lastDay: string; note: string }): Promise<ActionResult> {
  const lastDay = input.lastDay.trim();
  if (lastDay && !isDateOnly(lastDay)) return fail("Use a date for the new last day off, or say the return is not known.");
  const note = input.note.trim();
  if (note.length > 200) return fail("Keep the note under 200 characters.");
  const found = await absenceFor(id);
  if (!found.ok) return fail(found.error);
  const { actor, person, absence } = found;
  if (absence.returnMetOn) return fail(RETURN_RECORDED);
  const was = absence.lastDay?.toISOString().slice(0, 10) ?? null;
  if (was && was < addDaysIso(today(), -1)) return fail(`${person.name} was back after ${was}. Report a new absence and link it if it is the same thing again.`);
  if (was === null && !lastDay) return fail(`${person.name}'s return is already not known. Choose the new last day off, if you know it.`);
  if (lastDay && was && lastDay <= was) return fail(`Their last day off is already ${was}. Choose a later day, or use Back at work if they returned sooner.`);
  if (lastDay && lastDay < absence.firstDay.toISOString().slice(0, 10)) return fail("The new last day can't be before the absence started.");
  // Running on must not run into another absence of theirs.
  const samePersonWhere = { OR: [...(absence.userId ? [{ userId: absence.userId }] : []), ...(absence.rotaPersonId ? [{ rotaPersonId: absence.rotaPersonId }] : [])] };
  const result = await prisma.$transaction(async (tx) => {
    const next = await tx.rotaAbsence.findFirst({
      where: { ...samePersonWhere, id: { not: id }, withdrawnAt: null, firstDay: { gt: absence.firstDay, ...(lastDay ? { lte: parseDateOnly(lastDay) } : {}) } },
      select: { firstDay: true },
    });
    if (next) return fail(`${person.name} already has an absence from ${next.firstDay.toISOString().slice(0, 10)}. End this one before it.`);
    const moved = await tx.rotaAbsence.updateMany({ where: { id, withdrawnAt: null, lastDay: absence.lastDay }, data: { lastDay: lastDay ? parseDateOnly(lastDay) : null } });
    if (moved.count !== 1) return fail("Someone changed this absence just now. Refresh and try again.");
    await tx.rotaAbsenceUpdate.create({ data: { absenceId: id, kind: "extended", lastDay: lastDay ? parseDateOnly(lastDay) : null, note, byId: actor.id, byName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaAbsence", entityId: id, clubId: null, summary: `Extended ${person.name}'s absence ${lastDay ? `to ${lastDay}` : "with the return not known"}` }, tx);
    return ok();
  });
  if (result.ok) revalidateRota();
  return result;
}

const returnSchema = z.object({
  metOn: z.string().refine(isDateOnly, "Choose the day you talked."),
  fit: z.enum(RETURN_FITS, { message: "Say whether they are fit to work." }),
  adjustments: z.string().trim().max(300, "Keep the changes under 300 characters."),
  /** "yes" or "no"; asked only for sickness over seven days. */
  fitNote: z.enum(["", "yes", "no"]).default(""),
  note: z.string().trim().max(500, "Keep the note under 500 characters."),
});
export type ReturnInput = z.input<typeof returnSchema>;

/** The return-to-work conversation, once they are back. It closes the
 *  absence: after it, the absence can no longer be extended or re-dated, and
 *  it is on their personal file. The shared log never names the reason. */
export async function recordReturnToWork(id: string, input: ReturnInput): Promise<ActionResult> {
  const parsed = returnSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { metOn, fit, adjustments, fitNote, note } = parsed.data;
  const found = await absenceFor(id);
  if (!found.ok) return fail(found.error);
  const { actor, person, absence } = found;
  if (absence.returnMetOn) return fail("Their return to work is already recorded.");
  const lastDay = absence.lastDay?.toISOString().slice(0, 10);
  if (!lastDay) return fail(`${person.name} is still off. Use Back at work first.`);
  if (metOn <= lastDay) return fail(`They were off until ${lastDay}, so the conversation is from the day after.`);
  if (metOn > today()) return fail("Record the conversation once it has happened.");
  if (fit === "adjusted" && !adjustments) return fail("Say what changes to their work you agreed.");
  const asked = needsFitNote({ reason: absence.reason, firstDay: absence.firstDay.toISOString().slice(0, 10), lastDay });
  if (asked && !fitNote) return fail("Say whether their fit note came in.");
  const result = await prisma.$transaction(async (tx) => {
    const saved = await tx.rotaAbsence.updateMany({
      where: { id, withdrawnAt: null, returnMetOn: null, lastDay: absence.lastDay },
      data: {
        returnMetOn: parseDateOnly(metOn), returnFit: fit, returnAdjustments: fit === "adjusted" ? adjustments : "",
        returnFitNote: asked ? fitNote === "yes" : null, returnNote: note, returnById: actor.id, returnByName: actor.name,
      },
    });
    if (saved.count !== 1) return fail("Someone changed this absence just now. Refresh and try again.");
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaAbsence", entityId: id, clubId: null, summary: `Recorded ${person.name}'s return to work on ${metOn}` }, tx);
    return ok();
  });
  if (result.ok) revalidateRota();
  return result;
}

/** Recorded in error: it no longer counts anywhere, and the change is logged. */
export async function withdrawAbsence(id: string): Promise<ActionResult> {
  const found = await absenceFor(id);
  if (!found.ok) return fail(found.error);
  const { actor, person } = found;
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.rotaAbsence.updateMany({ where: { id, withdrawnAt: null }, data: { withdrawnAt: new Date() } });
    if (moved.count !== 1) return fail("That absence is already removed.");
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "cancel", entity: "RotaAbsence", entityId: id, clubId: null, summary: `Removed an absence recorded for ${person.name}` }, tx);
    return ok();
  });
  if (result.ok) revalidateRota();
  return result;
}
