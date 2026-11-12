"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { dublinInstant, formatShortDay, formatTime, toDateOnlyString } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { attendanceStrike, CALL_METHODS, isAway, judgeCallOff, STRIKE_CAUSE_META, toMinutes } from "@/modules/staffing/shared/rules";
import { atSite, recordStrike, refresh, settingsFor, poolStaff } from "@/modules/staffing/shared/server";

/** The duty manager's writes (BR-6, BR-10): log a call-off, a late arrival or a no-show against a
 *  published shift, and put someone on in an away person's place. Whether a call-off was on time
 *  is worked out from the logged time, never typed; any strike follows from the rules. */

const logSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("call_off"),
    calledAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Give the time they called."),
    calledOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Give the day they called."),
    method: z.enum(CALL_METHODS),
    reason: z.enum(["sick", "other"]),
    exceptional: z.boolean().default(false),
    note: z.string().trim().max(500).default(""),
  }),
  z.object({
    kind: z.literal("late"),
    minutesLate: z.coerce.number().int().min(1, "Say how many minutes late.").max(600),
    sentHome: z.boolean().default(false),
    note: z.string().trim().max(500).default(""),
  }),
  z.object({ kind: z.literal("no_show"), note: z.string().trim().max(500).default("") }),
]);
export type AttendanceInput = z.input<typeof logSchema>;

export async function logAttendance(shiftId: string, input: AttendanceInput): Promise<ActionResult> {
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const shift = await prisma.staffingShift.findUnique({ where: { id: shiftId }, include: { block: { select: { publishedAt: true } } } });
  if (!shift?.userId) return fail("Nobody is on that shift.");
  if (!shift.block.publishedAt) return fail("That block is not published yet.");
  const at = await atSite(shift.siteId, "staffing.run");
  if (!at.ok) return fail(at.error);
  if (isAway(shift.status)) return fail("Something is already logged for this shift.");
  const settings = await settingsFor(at.actor.orgId);
  const day = toDateOnlyString(shift.date);
  const person = (await poolStaff(at.actor.orgId)).find((p) => p.id === shift.userId)?.name ?? "Someone";
  let onTime: boolean | null = null;
  let calledAt: Date | null = null;
  if (d.kind === "call_off") {
    calledAt = dublinInstant(d.calledOn, toMinutes(d.calledAt));
    if (!calledAt) return fail("That time does not exist on that day.");
    if (calledAt.getTime() > Date.now() + 60_000) return fail("The call can't be in the future.");
    onTime = judgeCallOff({ date: day, startMin: shift.startMin }, calledAt, d.method, d.exceptional, settings).onTime;
  }
  const swapTaken = d.kind === "no_show" && !!(await prisma.staffingSwap.findFirst({ where: { shiftId, takerId: shift.userId, status: "approved" }, select: { id: true } }));
  const cause = attendanceStrike({ kind: d.kind, reason: d.kind === "call_off" ? d.reason : null, onTime, minutesLate: d.kind === "late" ? d.minutesLate : null, swapTaken }, settings);
  const status = d.kind === "call_off" ? "called_off" : d.kind === "no_show" ? "no_show" : d.sentHome ? "sent_home" : "late";
  await prisma.$transaction(async (tx) => {
    const log = await tx.staffingAttendance.create({ data: {
      orgId: at.actor.orgId, siteId: shift.siteId, shiftId, userId: shift.userId!, kind: d.kind, calledAt, method: d.kind === "call_off" ? d.method : null,
      reason: d.kind === "call_off" ? d.reason : null, note: d.note, onTime, minutesLate: d.kind === "late" ? d.minutesLate : null,
      sentHome: d.kind === "late" && d.sentHome, loggedById: at.actor.id, loggedBy: at.actor.name,
    } });
    await tx.staffingShift.update({ where: { id: shiftId }, data: { status } });
    const what = d.kind === "call_off" ? `${person} called off ${shift.name} (${d.reason === "sick" ? "sick" : "not sickness"}), ${onTime ? "on time" : "late"}`
      : d.kind === "late" ? `${person} was ${d.minutesLate} minutes late for ${shift.name}${d.sentHome ? " and was sent home unpaid" : ""}` : `${person} did not call or show for ${shift.name}`;
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "StaffingAttendance", entityId: log.id, clubId: shift.siteId,
      summary: `${what}, ${formatShortDay(shift.date)} ${formatTime(shift.startMin)}${cause ? `. Strike: ${STRIKE_CAUSE_META[cause].label.toLowerCase()}` : ""}` }, tx);
    if (cause) await recordStrike(tx, { orgId: at.actor.orgId, siteId: shift.siteId, userId: shift.userId!, cause, occurredOn: day, sourceId: log.id, settings, actor: at.actor, personName: person });
  });
  refresh();
  return ok();
}

/** Put someone on in place of an away person, or on an empty place, today or later (BR-10.1).
 *  The away shift is kept as it was; the cover is its own shift. Warnings were shown first. */
export async function coverShift(shiftId: string, userId: string): Promise<ActionResult> {
  const shift = await prisma.staffingShift.findUnique({ where: { id: shiftId }, include: { block: { select: { publishedAt: true } } } });
  if (!shift) return fail("That shift no longer exists.");
  const at = await atSite(shift.siteId, "staffing.run");
  if (!at.ok) return fail(at.error);
  const person = (await poolStaff(at.actor.orgId)).find((p) => p.id === userId);
  if (!person) return fail("That person is not on the Staffing rota.");
  if (shift.userId === userId) return fail(`${person.name} is already on this shift.`);
  if (!shift.userId) {
    await prisma.$transaction(async (tx) => {
      await tx.staffingShift.update({ where: { id: shiftId }, data: { userId } });
      await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "update", entity: "StaffingShift", entityId: shiftId, clubId: shift.siteId,
        summary: `Covered the empty place on ${shift.name} with ${person.name}, ${formatShortDay(shift.date)}` }, tx);
    });
    refresh();
    return ok();
  }
  if (!isAway(shift.status)) return fail("The person on this shift is not away. Log a call-off first.");
  if (await prisma.staffingShift.findFirst({ where: { coversId: shiftId, status: { in: ["scheduled", "late"] } }, select: { id: true } })) return fail("Someone already covers this shift.");
  await prisma.$transaction(async (tx) => {
    const cover = await tx.staffingShift.create({ data: {
      orgId: shift.orgId, siteId: shift.siteId, blockId: shift.blockId, slotId: shift.slotId, date: shift.date, startMin: shift.startMin, endMin: shift.endMin,
      role: shift.role, name: shift.name, userId, coversId: shiftId,
    } });
    await logAudit({ actorId: at.actor.id, actorName: at.actor.name, action: "create", entity: "StaffingShift", entityId: cover.id, clubId: shift.siteId,
      summary: `${person.name} covers ${shift.name}, ${formatShortDay(shift.date)} ${formatTime(shift.startMin)}` }, tx);
  });
  refresh();
  return ok();
}
