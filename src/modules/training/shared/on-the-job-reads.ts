import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { qualificationsHeldBy, qualificationTypesByIds } from "@/lib/qualifications";
import { hoursProgress, pathProgress, sessionWhen, windowStart } from "@/modules/training/shared/on-the-job";

/** One person's skills on the job (phase 5): their hours, sessions and paths.
 *  No access check here: callers check first (the person's Training record
 *  through personTraining, or the staff API for the person themselves). */

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

/** One person's hours: progress against each target they hold, and their log. For their record and Turnfin Me. */
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

/** A person's sessions, for their record and for Turnfin Me. */
export async function sessionsOf(userId: string) {
  const rows = await prisma.trainingSessionPlace.findMany({
    where: { userId, session: { cancelledAt: null } }, orderBy: { session: { startsAt: "desc" } }, take: 30,
    select: { status: true, session: { select: { id: true, title: true, startsAt: true, minutes: true, location: true, siteId: true, trainerName: true, registerClosedAt: true, course: { select: { title: true } } } } },
  });
  return rows.map((r) => ({ id: r.session.id, title: r.session.title, when: sessionWhen(r.session.startsAt, r.session.minutes), startsAt: r.session.startsAt,
    course: r.session.course?.title ?? null, location: r.session.location, siteId: r.session.siteId, trainerName: r.session.trainerName, status: r.status, closed: !!r.session.registerClosedAt }));
}

/** The learning paths a person is on, with where they are. */
export async function pathsOf(userId: string) {
  const enrolments = await prisma.trainingPathEnrolment.findMany({ where: { userId, cancelledAt: null }, orderBy: { startsOn: "desc" }, select: {
    id: true, startsOn: true, path: { select: { id: true, title: true, summary: true, steps: { orderBy: { position: "asc" }, select: { courseId: true, dueDays: true, course: { select: { title: true } } } } } },
  } });
  if (!enrolments.length) return [];
  const courseIds = [...new Set(enrolments.flatMap((e) => e.path.steps.map((s) => s.courseId)))];
  const history = await prisma.trainingAssignment.findMany({ where: { userId, courseId: { in: courseIds }, status: { not: "CANCELLED" } }, select: { id: true, courseId: true, status: true, dueOn: true, completedAt: true } });
  const on = parseDateOnly(today());
  return enrolments.map((e) => {
    const progress = pathProgress(e.path.steps.map((s) => ({ courseId: s.courseId, dueDays: s.dueDays })), history, on);
    return { id: e.id, pathId: e.path.id, title: e.path.title, summary: e.path.summary, startsOn: e.startsOn, ...progress,
      steps: e.path.steps.map((s, i) => ({ courseId: s.courseId, title: s.course.title, state: progress.states[i], assignmentId: history.find((h) => h.courseId === s.courseId && (h.status === "ASSIGNED" || h.status === "SUBMITTED"))?.id ?? null })) };
  });
}

