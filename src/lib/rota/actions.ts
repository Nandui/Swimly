"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { ABSENCE_REASONS, RETURN_FITS, addDaysIso, clock, needsFitNote, parseClock } from "@/lib/rota/constants";
import { notifyShiftChange } from "@/lib/staff-api/reminders";

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
  let previousUserId: string | null = null;
  const result = await prisma.$transaction(async (tx) => {
    if (id) {
      const existing = await tx.rotaShift.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, userId: true } });
      if (!existing) return fail("That shift no longer exists.");
      // Moving a shift between sites needs the permission at both.
      if (existing.siteId !== site.id) {
        const from = await allowedAt(existing.siteId);
        if (!from.ok) return fail(from.error);
      }
      previousUserId = existing.userId;
      await tx.rotaShift.update({ where: { id }, data: values });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaShift", entityId: id, clubId: site.id, summary: `Changed ${summary}` }, tx);
    } else {
      const created = await tx.rotaShift.create({ data: { ...values, orgId: site.orgId!, createdById: actor.id, createdByName: actor.name } });
      await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaShift", entityId: created.id, clubId: site.id, summary: `Added ${summary}` }, tx);
    }
    return ok();
  });
  if (result.ok) {
    revalidatePath("/rota");
    // Tell the people whose shifts changed (Turnfin Me email, if they want it).
    await notifyShiftChange(data.userId, `${id ? "Your shift changed" : "You have a new shift"}: ${summary}.`);
    if (previousUserId && previousUserId !== data.userId) await notifyShiftChange(previousUserId, `You are no longer on this shift: ${summary}.`);
  }
  return result;
}

export async function cancelShift(id: string): Promise<ActionResult> {
  const shift = await prisma.rotaShift.findFirst({ where: { id, cancelledAt: null }, select: { siteId: true, role: true, date: true, startMinutes: true, endMinutes: true, userId: true } });
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
  if (result.ok) {
    revalidatePath("/rota");
    await notifyShiftChange(shift.userId, `Your shift was cancelled: ${shift.role} at ${site.name} on ${shift.date.toISOString().slice(0, 10)}, ${clock(shift.startMinutes)}–${clock(shift.endMinutes)}.`);
  }
  return result;
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
