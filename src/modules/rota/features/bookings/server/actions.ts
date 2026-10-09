"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { BOOKING_KINDS, addDaysIso, bookingDates, parseClock } from "@/modules/rota/shared/constants";
import { areaProblem } from "@/lib/setup/data";
import { notifyShiftChange } from "@/lib/staff-api/notify";
import { allowedFor, refresh } from "@/modules/rota/shared/writes";

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
