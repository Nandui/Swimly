import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { multiplePlacesQuery, staffActivityQuery } from "./queries";
import { multiplePlaces, type PlaceRow } from "./multiple-places";
import { instructorAttendanceQuery } from "./attendance-query";
import { analyticsPeriod } from "./rules";
import { instructorAttendanceTotals, staffActivityTotals, type AttendanceOccurrence, type StaffActivity } from "./reports";

async function reportContext(now: Date) {
  const session = await requireSession();
  if (!canSee(session, "analytics")) throw new AuthorizationError("Analytics access is required.");
  const { club } = await getCurrentClub();
  return { club, session, period: analyticsPeriod(now), updatedAt: now.toISOString() };
}

export async function getReceptionAnalytics(now = new Date()) {
  const { club, period, updatedAt } = await reportContext(now);
  const rows = await prisma.$queryRaw<StaffActivity[]>(staffActivityQuery([club.id], period.weekStart, now));
  return { siteName: club.name, period, updatedAt, people: staffActivityTotals(period.days, rows) };
}

export async function getInstructorAnalytics(now = new Date()) {
  const { club, session, period, updatedAt } = await reportContext(now);
  const rows = await prisma.$queryRaw<AttendanceOccurrence[]>(instructorAttendanceQuery(club.id, period.weekStart, period.weekEnd, now));
  return { siteName: club.name, period, updatedAt, canOpenClasses: canSee(session, "courses"), ...instructorAttendanceTotals(rows, now) };
}

/** Swimmers with more than one current place at the selected site. */
export async function getMultiplePlacesAnalytics(now = new Date()) {
  const { club, session, period, updatedAt } = await reportContext(now);
  const definition = { id: true, sharedWithId: true, name: true } as const;
  const [rows, levels, programmes] = await prisma.$transaction(async tx => Promise.all([
    tx.$queryRaw<PlaceRow[]>(multiplePlacesQuery(club.id, period.date)),
    tx.level.findMany({ select: definition }),
    tx.programme.findMany({ select: definition }),
  ]), { isolationLevel: "RepeatableRead" });
  return { siteName: club.name, date: period.date, updatedAt, canOpenSwimmers: canSee(session, "students"), ...multiplePlaces(rows, levels, programmes) };
}

export type ReceptionAnalyticsData = Awaited<ReturnType<typeof getReceptionAnalytics>>;
export type InstructorAnalyticsData = Awaited<ReturnType<typeof getInstructorAnalytics>>;
export type MultiplePlacesAnalyticsData = Awaited<ReturnType<typeof getMultiplePlacesAnalytics>>;
