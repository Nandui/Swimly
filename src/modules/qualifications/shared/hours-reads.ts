import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationsHeldBy, qualificationTypesByIds } from "@/lib/qualifications";
import { hoursProgress, windowStart } from "@/modules/qualifications/shared/hours";

/** People's in-service hours. No access check here: callers check first (the hours page through
 *  `qualifications.manage`, or the staff API for the person themselves). */

const current = (q: { revokedAt: Date | null; expiresOn: Date | null }, on: Date) => !q.revokedAt && (!q.expiresOn || q.expiresOn >= on);

/** Hours and progress for a set of people: one entry per target they hold a current qualification for. */
export async function progressFor(orgId: string | null, userIds: string[], on: Date) {
  const targets = await prisma.trainingHourTarget.findMany({ where: { orgId: orgId ?? undefined }, select: { typeId: true, hours: true, windowMonths: true } });
  if (!targets.length || !userIds.length) return { targets, held: [] as { userId: string; typeId: string }[], entries: [] as { userId: string; typeId: string | null; on: Date; minutes: number }[] };
  const since = windowStart(on, Math.max(...targets.map((t) => t.windowMonths)));
  const [quals, entries] = await Promise.all([
    qualificationsHeldBy(userIds),
    prisma.trainingHours.findMany({ where: { userId: { in: userIds }, removedAt: null, on: { gte: since }, typeId: { in: targets.map((t) => t.typeId) } }, select: { userId: true, typeId: true, on: true, minutes: true } }),
  ]);
  const held = quals.filter((q) => current(q, on) && targets.some((t) => t.typeId === q.typeId)).map((q) => ({ userId: q.userId, typeId: q.typeId }));
  return { targets, held: [...new Map(held.map((h) => [`${h.userId}:${h.typeId}`, h])).values()], entries };
}

/** One person's hours: progress against each target they hold, and their log. For Turnfin Me. */
export async function hoursOf(userId: string, orgId: string | null) {
  const on = parseDateOnly(today());
  const [{ targets, held, entries }, log] = await Promise.all([
    progressFor(orgId, [userId], on),
    prisma.trainingHours.findMany({ where: { userId, removedAt: null }, orderBy: [{ on: "desc" }, { createdAt: "desc" }], take: 30, select: { id: true, typeId: true, on: true, minutes: true, topic: true, recordedByName: true } }),
  ]);
  const typeNames = await qualificationTypesByIds([...targets.map((t) => t.typeId), ...log.map((l) => l.typeId)]);
  const progress = held.map((h) => {
    const t = targets.find((x) => x.typeId === h.typeId)!;
    return { typeId: h.typeId, typeName: typeNames.get(h.typeId)?.name ?? "Removed qualification", hours: t.hours, windowMonths: t.windowMonths, ...hoursProgress(entries.filter((e) => e.typeId === h.typeId), t, on) };
  });
  return { progress, log: log.map((l) => ({ ...l, typeName: l.typeId ? typeNames.get(l.typeId)?.name ?? "Removed qualification" : null })) };
}
