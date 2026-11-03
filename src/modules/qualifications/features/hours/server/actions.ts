"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { activeStaffAmong } from "@/lib/directory";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { filterAllows } from "@/lib/policy/engine";
import { subjectsFor } from "@/lib/policy/session";
import { liveQualificationTypeById, qualificationTypeById } from "@/lib/qualifications";
import { requireQualificationsActor } from "@/modules/qualifications/shared/access";
import { hoursInWords } from "@/modules/qualifications/shared/hours";

/** In-service hours. Logging and removing hours needs `qualifications.manage` for those people,
 *  never yourself; setting what a qualification needs needs it anywhere. Audited. */

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
const refresh = () => revalidatePath("/staff-qualifications/hours");

const entrySchema = z.object({
  typeId: z.string().max(64).nullable().default(null),
  on: z.string().refine(isDateOnly, "Choose the date."),
  minutes: z.number().int().min(5, "Log at least 5 minutes.").max(1440, "Log at most a day at a time."),
  topic: z.string().trim().min(3, "Say what the training covered.").max(200, "Keep the topic under 200 characters."),
});
export type HoursInput = z.input<typeof entrySchema>;

export async function logHours(userIds: string[], input: HoursInput): Promise<{ ok: true; logged: number } | Extract<ActionResult, { ok: false }>> {
  const who = await requireQualificationsActor();
  if (!who.orgId) return fail("Logging hours needs an organisation.");
  const orgId = who.orgId;
  const parsed = entrySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const e = parsed.data;
  if (e.on > today()) return fail("Hours can't be logged for a day still to come.");
  const ids = [...new Set(userIds.map(String))].slice(0, 500);
  if (!ids.length) return fail("Choose at least one person.");
  if (ids.includes(who.id)) return fail("Someone else has to log your own hours.");
  const scope = await subjectsFor("qualifications.manage");
  if (ids.some((id) => !filterAllows(scope, id))) return fail("You can only log hours for the people your role covers.");
  const type = e.typeId ? await liveQualificationTypeById(e.typeId, orgId) : null;
  if (e.typeId && !type) return fail("That qualification has been removed. Choose another.");
  const result = await prisma.$transaction(async (tx) => {
    const learners = await activeStaffAmong(orgId, ids, tx);
    if (learners.length !== ids.length) return fail("Someone you chose is no longer active. Refresh and try again.");
    for (const learner of learners) {
      const row = await tx.trainingHours.create({ data: {
        orgId, userId: learner.id, typeId: type?.id ?? null, on: parseDateOnly(e.on), minutes: e.minutes, topic: e.topic, recordedById: who.id, recordedByName: who.name,
      }, select: { id: true } });
      await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "TrainingHours", entityId: row.id,
        summary: `Logged ${hoursInWords(e.minutes)} of ${type ? `${type.name} ` : ""}in-service training for ${learner.name}: ${e.topic}` }, tx);
    }
    return { ok: true as const, logged: learners.length };
  });
  if (result.ok) refresh();
  return result;
}

export async function removeHours(id: string, reason: string): Promise<ActionResult> {
  const who = await requireQualificationsActor();
  if (!who.orgId) return fail("Removing hours needs an organisation.");
  const why = text(reason, 300);
  if (why.length < 3) return fail("Say briefly why these hours are removed.");
  const row = await prisma.trainingHours.findFirst({ where: { id, orgId: who.orgId, removedAt: null }, select: { userId: true, minutes: true, topic: true } });
  if (!row) return fail("Those hours are already removed.");
  if (row.userId === who.id || !filterAllows(await subjectsFor("qualifications.manage"), row.userId)) return fail("Someone else has to change these hours.");
  const result = await prisma.$transaction(async (tx) => {
    const moved = await tx.trainingHours.updateMany({ where: { id, removedAt: null }, data: { removedAt: new Date(), removedByName: who.name } });
    if (moved.count !== 1) return fail("Those hours are already removed.");
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "TrainingHours", entityId: id, summary: `Removed ${hoursInWords(row.minutes)} of in-service training (${row.topic}): ${why}` }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

const targetSchema = z.object({
  hours: z.number().int().min(1, "Ask for at least 1 hour.").max(500, "Ask for at most 500 hours."),
  windowMonths: z.number().int().min(1, "Count over at least 1 month.").max(120, "Count over at most 10 years."),
});

export async function saveHourTarget(typeId: string, input: z.input<typeof targetSchema>): Promise<ActionResult> {
  const who = await requireQualificationsActor();
  if (!who.orgId) return fail("Setting what a qualification needs needs an organisation.");
  const parsed = targetSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const type = await liveQualificationTypeById(typeId, who.orgId);
  if (!type) return fail("That qualification has been removed.");
  const { hours, windowMonths } = parsed.data;
  await prisma.$transaction(async (tx) => {
    const row = await tx.trainingHourTarget.upsert({ where: { typeId }, create: { orgId: who.orgId!, typeId, hours, windowMonths }, update: { hours, windowMonths }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "update", entity: "TrainingHourTarget", entityId: row.id, summary: `${type.name} now needs ${hours} in-service ${hours === 1 ? "hour" : "hours"} every ${windowMonths} ${windowMonths === 1 ? "month" : "months"}` }, tx);
  });
  refresh();
  return ok();
}

export async function removeHourTarget(typeId: string): Promise<ActionResult> {
  const who = await requireQualificationsActor();
  if (!who.orgId) return fail("Setting what a qualification needs needs an organisation.");
  const type = await qualificationTypeById(typeId, who.orgId);
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.trainingHourTarget.findFirst({ where: { typeId, orgId: who.orgId! }, select: { id: true } });
    if (!row) return fail("That qualification has no hours target.");
    await tx.trainingHourTarget.delete({ where: { id: row.id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "delete", entity: "TrainingHourTarget", entityId: row.id, summary: `${type?.name ?? "A removed qualification"} no longer needs in-service hours` }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}
