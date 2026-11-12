"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { addDaysIso, formatShortDay, isDateOnly, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  blockEnd, hoursAgainstContract, hoursUntil, isoWeekday, placesFor, shiftStart,
} from "@/modules/staffing/shared/rules";
import { atSite, dateOf, refresh, settingsFor, poolStaff } from "@/modules/staffing/shared/server";

/** Writes for rota blocks (BR-2, 3, 4): start one from the slots and the block before, put people
 *  on its places, publish it, and record acknowledgements. Warnings never refuse (owner's choice);
 *  the process rules do: a published shift changes only with Manage and a reason (BR-2.4), and
 *  nothing is published under the minimum notice (BR-2.3). Every write is audited. */

/** Start a block at a site on a Monday: every slot on each of its days, with the people from the
 *  same place in the block before when they are still on the rota (BR-5.3 steps 1 and 2). */
export async function createBlock(siteId: string, startsOn: string): Promise<{ ok: true; id: string } | Extract<ActionResult, { ok: false }>> {
  const at = await atSite(siteId, "staffing.supervise");
  if (!at.ok) return fail(at.error);
  if (!isDateOnly(startsOn) || isoWeekday(startsOn) !== 1) return fail("A block starts on a Monday.");
  if (await prisma.staffingBlock.findUnique({ where: { siteId_startsOn: { siteId, startsOn: dateOf(startsOn) } }, select: { id: true } })) {
    return fail(`There is already a block starting ${formatShortDay(dateOf(startsOn))} at ${at.site.name}.`);
  }
  const slots = await prisma.staffingSlot.findMany({ where: { siteId, archivedAt: null } });
  if (slots.length === 0) return fail(`${at.site.name} has no slots yet. Add the weekly slots under Set up first.`);
  const previousStart = addDaysIso(startsOn, -14);
  const previous = await prisma.staffingBlock.findUnique({ where: { siteId_startsOn: { siteId, startsOn: dateOf(previousStart) } }, include: { shifts: { where: { coversId: null }, select: { slotId: true, date: true, userId: true } } } });
  const kept = new Set((await poolStaff(at.actor.orgId)).map((t) => t.id));
  // A cover is a second row for the same place (`coversId`): carry the person rostered on it.
  const previousShifts = previous?.shifts.map((s) => ({ slotId: s.slotId, date: toDateOnlyString(s.date), userId: s.userId })) ?? [];
  const places = placesFor(startsOn, slots, previous ? { startsOn: previousStart, shifts: previousShifts } : null, (id) => kept.has(id));
  const id = await prisma.$transaction(async (tx) => {
    const block = await tx.staffingBlock.create({ data: { orgId: at.actor.orgId, siteId, startsOn: dateOf(startsOn) } });
    await tx.staffingShift.createMany({ data: places.map((p) => ({ orgId: at.actor.orgId, siteId, blockId: block.id, slotId: p.slotId, date: dateOf(p.date), startMin: p.startMin, endMin: p.endMin, role: p.role, name: p.name, userId: p.userId })) });
    const carried = places.filter((p) => p.userId).length;
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "StaffingBlock", entityId: block.id, clubId: siteId,
      summary: `Started the rota block from ${formatShortDay(dateOf(startsOn))} at ${at.site.name}: ${places.length} places${previous ? `, ${carried} carried over from the block before` : ""}` }, tx);
    return block.id;
  });
  refresh(`/staffing/blocks/${id}`);
  return { ok: true, id };
}

const assignSchema = z.object({ userId: z.string().nullable(), reason: z.string().trim().max(300).default("") });

/** Put a person on a place, change who is on it, or empty it. On a published block this is an
 *  override (BR-2.4): Manage only, with a reason, and never under the minimum notice. */
export async function assignShift(shiftId: string, input: z.input<typeof assignSchema>): Promise<ActionResult> {
  const parsed = assignSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { userId, reason } = parsed.data;
  const shift = await prisma.staffingShift.findUnique({ where: { id: shiftId }, include: { block: { select: { publishedAt: true, id: true } } } });
  if (!shift) return fail("That place no longer exists.");
  const published = !!shift.block.publishedAt;
  const at = await atSite(shift.siteId, published ? "staffing.manage" : "staffing.supervise");
  if (!at.ok) return fail(published ? "This block is published: only Staffing Manage can change it, with a reason. Otherwise use a swap or an absence." : at.error);
  if (published && reason.length < 3) return fail("Say why this published shift is changing.");
  const day = toDateOnlyString(shift.date);
  const settings = await settingsFor(at.actor.orgId);
  if (published && userId && hoursUntil(shiftStart({ date: day, startMin: shift.startMin }), new Date()) < settings.minNoticeHours) {
    return fail(`That shift starts in under ${settings.minNoticeHours} hours, the legal minimum notice. Cover it from Today instead.`);
  }
  if (shift.status !== "scheduled") return fail("That person is away from this shift. Cover it from Today instead.");
  const people = await poolStaff(at.actor.orgId);
  const person = userId ? people.find((p) => p.id === userId) : null;
  if (userId && !person) return fail("That person is not on the Staffing rota. Add them under Set up, Staff.");
  if (shift.userId === userId) return ok();
  const before = shift.userId ? people.find((p) => p.id === shift.userId)?.name ?? "someone" : null;
  await prisma.$transaction(async (tx) => {
    await tx.staffingShift.update({ where: { id: shiftId }, data: { userId } });
    if (published && userId) await tx.staffingAck.upsert({ where: { blockId_userId: { blockId: shift.block.id, userId } }, create: { blockId: shift.block.id, userId }, update: {} });
    const what = person ? (before ? `Moved ${shift.name} from ${before} to ${person.name}` : `Put ${person.name} on ${shift.name}`) : `Took ${before} off ${shift.name}`;
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "StaffingShift", entityId: shiftId, clubId: shift.siteId,
      summary: `${what}, ${formatShortDay(shift.date)}${published ? ` (published block, override: ${reason})` : ""}` }, tx);
  });
  refresh(`/staffing/blocks/${shift.blockId}`);
  return ok();
}

/** Publish a block (BR-2.2 to 2.3, 3.8, 4.1): no shift under the minimum notice, and people
 *  still below their contracted hours must be accepted with a note. Starts acknowledgement
 *  tracking for everyone on it. */
export async function publishBlock(blockId: string, acceptShort: string): Promise<ActionResult> {
  const block = await prisma.staffingBlock.findUnique({ where: { id: blockId }, include: { shifts: true } });
  if (!block) return fail("That block no longer exists.");
  const at = await atSite(block.siteId, "staffing.supervise");
  if (!at.ok) return fail(at.error);
  if (block.publishedAt) return fail("This block is already published.");
  const settings = await settingsFor(at.actor.orgId);
  const now = new Date();
  const soon = block.shifts.find((s) => s.userId && hoursUntil(shiftStart({ date: toDateOnlyString(s.date), startMin: s.startMin }), now) < settings.minNoticeHours);
  if (soon) return fail(`${soon.name} on ${formatShortDay(soon.date)} starts in under ${settings.minNoticeHours} hours, the legal minimum notice. Publish blocks further ahead.`);
  const startsOn = toDateOnlyString(block.startsOn);
  const people = await poolStaff(at.actor.orgId);
  const contracts = new Map(people.filter((p) => p.contractMinutes !== null).map((p) => [p.id, p.contractMinutes!]));
  const short = hoursAgainstContract(startsOn, block.shifts.map((s) => ({ ...s, date: toDateOnlyString(s.date) })), contracts).filter((h) => h.short > 0);
  const note = acceptShort.trim();
  if (short.length && note.length < 3) {
    const names = short.map((h) => people.find((p) => p.id === h.userId)?.name ?? "someone");
    return fail(`${names.length === 1 ? `${names[0]} is` : `${names.length} people are`} below contracted hours (${names.slice(0, 4).join(", ")}${names.length > 4 ? "…" : ""}). Fill their hours, or say why you accept it.`);
  }
  const rostered = [...new Set(block.shifts.map((s) => s.userId).filter((id): id is string => !!id))];
  await prisma.$transaction(async (tx) => {
    await tx.staffingBlock.update({ where: { id: blockId }, data: { publishedAt: now, publishedById: at.actor.id, publishedByName: at.actor.name, shortAccepted: short.length ? note : null } });
    await tx.staffingAck.createMany({ data: rostered.map((userId) => ({ blockId, userId })), skipDuplicates: true });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "submit", entity: "StaffingBlock", entityId: blockId, clubId: block.siteId,
      summary: `Published the rota block ${formatShortDay(block.startsOn)} to ${formatShortDay(dateOf(blockEnd(startsOn)))} at ${at.site.name} for ${rostered.length} people${short.length ? `; ${short.length} below contracted hours accepted: ${note}` : ""}` }, tx);
  });
  refresh(`/staffing/blocks/${blockId}`);
  return ok();
}

/** Record that someone acknowledged the block (they told a supervisor, or Turnfin Me later), or
 *  that the supervisor phoned them (BR-4.2). Shifts stand either way (BR-4.3). */
export async function recordAck(blockId: string, userId: string, what: "acknowledged" | "phoned"): Promise<ActionResult> {
  const ack = await prisma.staffingAck.findUnique({ where: { blockId_userId: { blockId, userId } }, include: { block: { select: { siteId: true, startsOn: true } } } });
  if (!ack) return fail("They are not on this block.");
  const at = await atSite(ack.block.siteId, "staffing.supervise");
  if (!at.ok) return fail(at.error);
  const person = (await poolStaff(at.actor.orgId)).find((p) => p.id === userId)?.name ?? "someone";
  await prisma.$transaction(async (tx) => {
    await tx.staffingAck.update({ where: { id: ack.id }, data: what === "acknowledged" ? { acknowledgedAt: new Date() } : { phonedAt: new Date(), phonedByName: at.actor.name } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "StaffingAck", entityId: ack.id, clubId: ack.block.siteId,
      summary: what === "acknowledged" ? `${person} acknowledged the rota block from ${formatShortDay(ack.block.startsOn)}` : `Phoned ${person} about acknowledging the rota block from ${formatShortDay(ack.block.startsOn)}` }, tx);
  });
  refresh(`/staffing/blocks/${blockId}`);
  return ok();
}

/** Delete a draft block, to start it again. A published block is kept. */
export async function deleteBlock(blockId: string): Promise<ActionResult> {
  const block = await prisma.staffingBlock.findUnique({ where: { id: blockId }, select: { siteId: true, startsOn: true, publishedAt: true } });
  if (!block) return fail("That block no longer exists.");
  const at = await atSite(block.siteId, "staffing.supervise");
  if (!at.ok) return fail(at.error);
  if (block.publishedAt) return fail("A published block is kept. Change its shifts instead.");
  await prisma.$transaction(async (tx) => {
    await tx.staffingBlock.delete({ where: { id: blockId } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "delete", entity: "StaffingBlock", entityId: blockId, clubId: block.siteId,
      summary: `Deleted the draft rota block from ${formatShortDay(block.startsOn)} at ${at.site.name}` }, tx);
  });
  refresh();
  return ok();
}
