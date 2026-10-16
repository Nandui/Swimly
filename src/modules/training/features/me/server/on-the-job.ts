import "server-only";
import { organisationChart } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { readObservation, readObservationRecord } from "@/modules/training/shared/on-the-job";
import { hoursOf, pathsOf, sessionsOf } from "@/modules/training/shared/on-the-job-reads";

/** The signed-in person's own skills on the job (phase 5), for Turnfin Me:
 *  their learning paths, sessions and in-service hours, and what a trainer
 *  watches for on their practical. Only ever their own records. */

export async function myPlan(userId: string, orgId: string | null) {
  const [paths, sessions, hours, chart] = await Promise.all([pathsOf(userId), sessionsOf(userId), hoursOf(userId, orgId), organisationChart()]);
  const site = new Map(chart.sites.map((s) => [s.id, s.name]));
  return { paths, hours, sessions: sessions.map((s) => ({ ...s, site: s.siteId ? site.get(s.siteId) ?? null : null })) };
}

/** A practical course's checklist and the last time a trainer marked it, for
 *  their own assignment. Null when the course has no checklist. */
export async function myPractical(userId: string, assignmentId: string) {
  const row = await prisma.trainingAssignment.findFirst({ where: { id: assignmentId, userId }, select: { observation: true, course: { select: { observation: true } } } });
  const steps = readObservation(row?.course.observation);
  if (!row || !steps.length) return null;
  const last = readObservationRecord(row.observation);
  return { steps, last };
}
