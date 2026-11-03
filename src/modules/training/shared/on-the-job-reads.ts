import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { pathProgress, sessionWhen } from "@/modules/training/shared/on-the-job";

/** One person's skills on the job (phase 5): their sessions and paths.
 *  No access check here: callers check first (the person's Training record
 *  through personTraining, or the staff API for the person themselves). */

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

