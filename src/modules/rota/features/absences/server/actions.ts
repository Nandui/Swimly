"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { staffStatus } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor } from "@/lib/policy/session";
import { ABSENCE_REASONS, RETURN_FITS, addDaysIso, needsFitNote } from "@/modules/rota/shared/constants";

/** Absences. Recording one needs Run (`rota.manage`) over that person: a site-scoped duty
 *  manager records absences only for people who work at their site. The shared log names the
 *  person and the days, never the reason. Reporting someone off turns their activities into gaps
 *  on the rota (nothing is removed), so the duty manager covers them from Today. */

const absenceSchema = z.object({
  userId: z.string().trim().min(1, "Choose who is off."),
  reason: z.enum(ABSENCE_REASONS, { message: "Choose a reason." }),
  firstDay: z.string().refine(isDateOnly, "Choose the first day off."),
  lastDay: z.string().trim().refine((v) => v === "" || isDateOnly(v), "Use a date for the last day, or leave it empty.").transform((v) => v || null),
  note: z.string().trim().max(200, "Keep the note under 200 characters."),
  /** Off again soon after an earlier absence, and it is the same thing: that absence. */
  continuesId: z.string().trim().max(64).optional().transform((v) => v || null),
});
export type AbsenceInput = z.input<typeof absenceSchema>;

const NOT_COVERED = "You can only record absences for people at the sites your role covers.";

async function allowedFor(userId: string | null) {
  const person = userId ? await staffStatus(userId) : null;
  if (!person?.orgId) return { ok: false as const, error: "That person is not on the rota." };
  try {
    const actor = await requireCapFor("rota.manage", { subjectUserId: person.id, orgId: person.orgId });
    return { ok: true as const, actor, person: { ...person, orgId: person.orgId } };
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false as const, error: NOT_COVERED };
    throw error;
  }
}

const days = (first: string, last: string | null) => (last ? (last === first ? `on ${first}` : `from ${first} to ${last}`) : `from ${first}`);
function revalidateRota() {
  revalidatePath("/rota");
  revalidatePath("/rota/today");
  revalidatePath("/rota/absences");
}

export async function reportAbsence(input: AbsenceInput): Promise<ActionResult> {
  const parsed = absenceSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { userId, reason, firstDay, lastDay, note, continuesId } = parsed.data;
  if (lastDay && lastDay < firstDay) return fail("The last day off can't be before the first.");
  const allowed = await allowedFor(userId);
  if (!allowed.ok) return fail(allowed.error);
  const { actor, person } = allowed;
  if (!person.isActive) return fail("That person is no longer active.");
  const result = await prisma.$transaction(async (tx) => {
    // One absence at a time: a second one over the same days is a mistake.
    const clash = await tx.rotaAbsence.findFirst({
      where: { userId: person.id, withdrawnAt: null, firstDay: { lte: parseDateOnly(lastDay ?? "9999-12-31") }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(firstDay) } }] },
      select: { id: true },
    });
    if (clash) return fail(`${person.name} is already recorded as off on some of those days. Extend that absence instead.`);
    const earlier = continuesId ? await tx.rotaAbsence.findFirst({ where: { id: continuesId, userId: person.id, withdrawnAt: null, lastDay: { lt: parseDateOnly(firstDay) } }, select: { id: true, firstDay: true } }) : null;
    if (continuesId && !earlier) return fail("The earlier absence to link to is not theirs, or has not ended.");
    const created = await tx.rotaAbsence.create({ data: { orgId: person.orgId, userId: person.id, reason, firstDay: parseDateOnly(firstDay), lastDay: lastDay ? parseDateOnly(lastDay) : null, note,
      reportedById: actor.id, reportedByName: actor.name, continuesId: earlier?.id ?? null } });
    await tx.rotaAbsenceUpdate.create({ data: { absenceId: created.id, kind: "reported", lastDay: created.lastDay, note, byId: actor.id, byName: actor.name } });
    const again = earlier ? `, off again after an absence from ${earlier.firstDay.toISOString().slice(0, 10)}` : "";
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "create", entity: "RotaAbsence", entityId: created.id, clubId: null, summary: `Recorded ${person.name} as off ${days(firstDay, lastDay)}${again}` }, tx);
    return ok();
  });
  if (result.ok) revalidateRota();
  return result;
}

async function absenceFor(id: string) {
  const absence = await prisma.rotaAbsence.findFirst({ where: { id, withdrawnAt: null }, select: { id: true, userId: true, reason: true, firstDay: true, lastDay: true, returnMetOn: true } });
  if (!absence) return { ok: false as const, error: "That absence no longer exists." };
  const allowed = await allowedFor(absence.userId);
  return allowed.ok ? { ...allowed, absence } : allowed;
}

const RETURN_RECORDED = "Their return to work is already recorded. If they are off again, report a new absence.";

/** They are back: the last day off is set, and the rota stops showing them off after it. */
export async function endAbsence(id: string, lastDay: string): Promise<ActionResult> {
  if (!isDateOnly(lastDay)) return fail("Choose their last day off.");
  const found = await absenceFor(id);
  if (!found.ok) return fail(found.error);
  const { actor, person, absence } = found;
  if (absence.returnMetOn) return fail(RETURN_RECORDED);
  const first = absence.firstDay.toISOString().slice(0, 10);
  if (lastDay < first) return fail(`Their absence started on ${first}, so the last day off can't be before it.`);
  await prisma.$transaction(async (tx) => {
    await tx.rotaAbsence.update({ where: { id }, data: { lastDay: parseDateOnly(lastDay) } });
    await tx.rotaAbsenceUpdate.create({ data: { absenceId: id, kind: "back", lastDay: parseDateOnly(lastDay), byId: actor.id, byName: actor.name } });
    await logAudit({ actorId: actor.id, actorName: actor.name, action: "update", entity: "RotaAbsence", entityId: id, clubId: null, summary: `Recorded ${person.name} as back after ${lastDay}` }, tx);
  });
  revalidateRota();
  return ok();
}

/** Still off: the same absence runs on, to a later last day or with the return not known. */
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
  const result = await prisma.$transaction(async (tx) => {
    const next = await tx.rotaAbsence.findFirst({
      where: { userId: absence.userId, id: { not: id }, withdrawnAt: null, firstDay: { gt: absence.firstDay, ...(lastDay ? { lte: parseDateOnly(lastDay) } : {}) } },
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

/** The return-to-work conversation, once they are back. It closes the absence and goes on their
 *  personal file. The shared log never names the reason. */
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
      data: { returnMetOn: parseDateOnly(metOn), returnFit: fit, returnAdjustments: fit === "adjusted" ? adjustments : "", returnFitNote: asked ? fitNote === "yes" : null,
        returnNote: note, returnById: actor.id, returnByName: actor.name },
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
