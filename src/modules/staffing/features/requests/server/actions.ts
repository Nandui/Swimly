"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { addDaysIso, dublinInstant, formatShortDay, formatTime, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  EXAM_OUTCOME_META, examApproved, examOutcome, examStrike, fitWarnings, seasonFor, shiftStart, swapAllowed, toMinutes,
} from "@/modules/staffing/shared/rules";
import { atSite, recordStrike, refresh, settingsFor, shiftsOf, poolStaff } from "@/modules/staffing/shared/server";

/** Swaps and exam absences (BR-5, BR-7), recorded in Work by the pool deck supervisor for the
 *  person who asked (Turnfin Me will let staff ask themselves). A swap leaves the shift with
 *  the requester until approved; on approval the taker owns it, strikes included. */

const at = (date: string) => new Date(`${date}T00:00:00Z`);

/** Ask for a swap: with a named taker (who may already have agreed), or "Looking for cover". */
export async function requestSwap(shiftId: string, input: { takerId: string | null; takerAgreed: boolean }): Promise<ActionResult> {
  const shift = await prisma.staffingShift.findUnique({ where: { id: shiftId }, include: { block: { select: { publishedAt: true } } } });
  if (!shift?.userId) return fail("Nobody is on that shift.");
  if (!shift.block.publishedAt) return fail("That block is not published yet: change the draft instead.");
  const where = await atSite(shift.siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  const settings = await settingsFor(where.actor.orgId);
  const start = shiftStart({ date: toDateOnlyString(shift.date), startMin: shift.startMin });
  if (!swapAllowed(start, new Date(), settings)) return fail(`That shift starts in under ${settings.swapNoticeHours} hours. Swaps close then: they phone the duty manager on the centre landline.`);
  if (await prisma.staffingSwap.findFirst({ where: { shiftId, status: { in: ["open", "accepted"] } }, select: { id: true } })) return fail("There is already a swap asked for on this shift.");
  const people = await poolStaff(where.actor.orgId);
  const requester = people.find((p) => p.id === shift.userId)?.name ?? "Someone";
  const taker = input.takerId ? people.find((p) => p.id === input.takerId) : null;
  if (input.takerId && !taker) return fail("That person is not on the Staffing rota.");
  if (taker?.id === shift.userId) return fail("They can't swap with themselves.");
  const status = taker && input.takerAgreed ? "accepted" : "open";
  await prisma.$transaction(async (tx) => {
    const row = await tx.staffingSwap.create({ data: {
      orgId: where.actor.orgId, siteId: shift.siteId, shiftId, requesterId: shift.userId!, takerId: taker?.id ?? null, status, acceptedAt: status === "accepted" ? new Date() : null,
    } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "create", entity: "StaffingSwap", entityId: row.id, clubId: shift.siteId,
      summary: `SWAP: ${requester} · ${formatShortDay(shift.date)} · ${shift.name} ${formatTime(shift.startMin)} to ${formatTime(shift.endMin)} · ${taker ? `Taken by: ${taker.name}${status === "accepted" ? "" : " (not yet agreed)"}` : "Looking for cover"}` }, tx);
  });
  refresh();
  return ok();
}

/** Someone takes an open swap. */
export async function acceptSwap(swapId: string, takerId: string): Promise<ActionResult> {
  const swap = await prisma.staffingSwap.findUnique({ where: { id: swapId }, include: { shift: true } });
  if (!swap) return fail("That swap no longer exists.");
  const where = await atSite(swap.siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  if (swap.status !== "open") return fail("That swap is no longer looking for cover.");
  const settings = await settingsFor(where.actor.orgId);
  if (!swapAllowed(shiftStart({ date: toDateOnlyString(swap.shift.date), startMin: swap.shift.startMin }), new Date(), settings)) return fail("That swap has expired: the shift stays with the person rostered.");
  const taker = (await poolStaff(where.actor.orgId)).find((p) => p.id === takerId);
  if (!taker) return fail("That person is not on the Staffing rota.");
  if (takerId === swap.requesterId) return fail("They can't swap with themselves.");
  await prisma.$transaction(async (tx) => {
    await tx.staffingSwap.update({ where: { id: swapId }, data: { takerId, status: "accepted", acceptedAt: new Date() } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: "update", entity: "StaffingSwap", entityId: swapId, clubId: swap.siteId,
      summary: `${taker.name} accepted the swap for ${swap.shift.name}, ${formatShortDay(swap.shift.date)}` }, tx);
  });
  refresh();
  return ok();
}

const decideSchema = z.object({ approve: z.boolean(), reason: z.string().trim().max(300).default("") });

/** Approve or refuse an accepted swap (BR-5.3, 5.4). Approving moves the shift to the taker and
 *  keeps the warnings they had; refusing needs a reason. */
export async function decideSwap(swapId: string, input: z.input<typeof decideSchema>): Promise<ActionResult> {
  const parsed = decideSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { approve, reason } = parsed.data;
  const swap = await prisma.staffingSwap.findUnique({ where: { id: swapId }, include: { shift: true } });
  if (!swap) return fail("That swap no longer exists.");
  const where = await atSite(swap.siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  if (swap.status !== "accepted" && !(swap.status === "open" && !approve)) return fail(swap.status === "open" ? "Nobody has taken this swap yet." : "This swap is already decided.");
  if (!approve && reason.length < 3) return fail("Say why the swap is refused.");
  if (approve && swap.shift.userId !== swap.requesterId) return fail("The shift has changed hands since this swap was asked for.");
  const people = await poolStaff(where.actor.orgId);
  const taker = swap.takerId ? people.find((p) => p.id === swap.takerId) : null;
  if (approve && !taker) return fail("The person taking it is no longer on the Staffing rota.");
  const date = toDateOnlyString(swap.shift.date);
  const settings = await settingsFor(where.actor.orgId);
  const warnings = taker ? fitWarnings({ id: swap.shiftId, date, startMin: swap.shift.startMin, endMin: swap.shift.endMin, role: swap.shift.role },
    { ...taker, shifts: (await shiftsOf([taker.id], addDaysIso(date, -7), addDaysIso(date, 7))) }, settings).map((w) => w.text) : [];
  const requester = people.find((p) => p.id === swap.requesterId)?.name ?? "Someone";
  await prisma.$transaction(async (tx) => {
    await tx.staffingSwap.update({ where: { id: swapId }, data: {
      status: approve ? "approved" : "refused", decidedAt: new Date(), decidedById: where.actor.id, decidedByName: where.actor.name, refusalReason: approve ? null : reason, warnings: approve ? warnings : [],
    } });
    if (approve) {
      await tx.staffingShift.update({ where: { id: swap.shiftId }, data: { userId: taker!.id } });
      await tx.staffingAck.upsert({ where: { blockId_userId: { blockId: swap.shift.blockId, userId: taker!.id } }, create: { blockId: swap.shift.blockId, userId: taker!.id, acknowledgedAt: new Date() }, update: {} });
    }
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: approve ? "approve" : "decline", entity: "StaffingSwap", entityId: swapId, clubId: swap.siteId,
      summary: approve ? `Approved ${requester}'s swap: ${taker!.name} works ${swap.shift.name}, ${formatShortDay(swap.shift.date)}${warnings.length ? ` (with warnings: ${warnings.join(" ")})` : ""}`
        : `Refused ${requester}'s swap for ${swap.shift.name}, ${formatShortDay(swap.shift.date)}: ${reason}` }, tx);
  });
  refresh();
  return ok();
}

const examSchema = z.object({
  requestedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the day they asked."),
  requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Give the time they asked."),
  noticeSentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().trim().max(500).default(""),
});

/** Record an exam absence with the college's notice (BR-7.3, 7.4). The outcome follows from the
 *  season's deadline, the request time and the notice's sent date: approved and unpaid, a strike
 *  when late, refused with a referral when there is no notice. */
export async function recordExamAbsence(shiftId: string, input: z.input<typeof examSchema>): Promise<ActionResult> {
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const shift = await prisma.staffingShift.findUnique({ where: { id: shiftId } });
  if (!shift?.userId) return fail("Nobody is on that shift.");
  const where = await atSite(shift.siteId, "staffing.supervise");
  if (!where.ok) return fail(where.error);
  if (shift.status !== "scheduled") return fail("Something is already logged for this shift.");
  const requestedAt = dublinInstant(d.requestedOn, toMinutes(d.requestedTime));
  if (!requestedAt) return fail("That time does not exist on that day.");
  if (requestedAt.getTime() > Date.now() + 60_000) return fail("The request can't be in the future.");
  const person = (await poolStaff(where.actor.orgId)).find((p) => p.id === shift.userId);
  if (!person) return fail("They are not on the Staffing rota.");
  if (person.college === "none") return fail(`${person.name} has no college on record. Set it under Set up, Staff.`);
  const date = toDateOnlyString(shift.date);
  const seasons = (await prisma.staffingExamSeason.findMany({ where: { orgId: where.actor.orgId, college: person.college } }))
    .map((x) => ({ ...x, startsOn: toDateOnlyString(x.startsOn), endsOn: toDateOnlyString(x.endsOn) }));
  const season = seasonFor(seasons, person.college, date);
  const settings = await settingsFor(where.actor.orgId);
  const outcome = examOutcome({ requestedAt, requestedOn: d.requestedOn, shift: { date, startMin: shift.startMin }, seasonStartsOn: season?.startsOn ?? null, noticeSentOn: d.noticeSentOn }, settings);
  const approved = examApproved(outcome);
  const cause = examStrike(outcome);
  await prisma.$transaction(async (tx) => {
    const row = await tx.staffingExamAbsence.create({ data: {
      orgId: where.actor.orgId, siteId: shift.siteId, userId: person.id, shiftId, requestedAt, noticeSentOn: d.noticeSentOn ? at(d.noticeSentOn) : null, outcome,
      status: approved ? "approved" : "refused", note: d.note, decidedById: where.actor.id, decidedByName: where.actor.name,
    } });
    if (approved) await tx.staffingShift.update({ where: { id: shiftId }, data: { status: "absent_approved" } });
    await logAudit({ actorId: where.actor.id, actorName: where.actor.name, action: approved ? "approve" : "decline", entity: "StaffingExamAbsence", entityId: row.id, clubId: shift.siteId,
      summary: `Exam absence for ${person.name}, ${shift.name} ${formatShortDay(shift.date)}${season ? "" : " (no exam season on record)"}: ${EXAM_OUTCOME_META[outcome].label}` }, tx);
    if (cause) {
      const strike = await recordStrike(tx, { orgId: where.actor.orgId, siteId: shift.siteId, userId: person.id, cause, occurredOn: date, sourceId: row.id, settings, actor: where.actor, personName: person.name });
      await tx.staffingExamAbsence.update({ where: { id: row.id }, data: { strikeId: strike.id } });
    }
  });
  refresh();
  return ok();
}
