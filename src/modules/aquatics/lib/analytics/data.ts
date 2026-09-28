import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { activityQuery, cancellationsQuery, currentEnrolmentsQuery, levelCapacityQuery } from "./queries";
import { activityTotals, analyticsPeriod, enrolmentTotals, type CancellationTotals, type CurrentEnrolment, type DailyActivity, type LevelCapacity } from "./rules";

export async function getAnalytics(now = new Date()) {
  const session = await requireSession();
  if (!canSee(session, "analytics")) throw new AuthorizationError("Analytics access is required.");
  const { club } = await getCurrentClub();
  // The sidebar is the single source of site selection for the dashboard.
  const clubIds = [club.id];
  const period = analyticsPeriod(now);
  const definition = { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true } as const;
  const [enrolments, levels, programmes, activity, cancellations, capacities] = await prisma.$transaction(async tx => Promise.all([
    tx.$queryRaw<CurrentEnrolment[]>(currentEnrolmentsQuery(clubIds, period.date)),
    tx.level.findMany({ select: { ...definition, programmeId: true } }),
    tx.programme.findMany({ select: definition }),
    tx.$queryRaw<DailyActivity[]>(activityQuery(clubIds, period.weekStart, now)),
    tx.$queryRaw<CancellationTotals[]>(cancellationsQuery(clubIds, period.monthStart, period.nextMonth)),
    tx.$queryRaw<LevelCapacity[]>(levelCapacityQuery(clubIds)),
  ]), { isolationLevel: "RepeatableRead" });
  return {
    siteName: club.name,
    period, updatedAt: now.toISOString(),
    ...enrolmentTotals(enrolments, levels, programmes, capacities), ...activityTotals(period.days, activity),
    cancellations: cancellations[0],
    canOpenCancellations: canSee(session, "cancellations"),
  };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;
