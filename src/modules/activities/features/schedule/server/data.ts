import { getCoversForDay } from "@/modules/activities/shared/attendance/data/cover";
import { getRegisterStateForDay } from "@/modules/activities/shared/attendance/data/register";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { AuthorizationError, can, canSee, requireSession } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getCoursesOnDate } from "@/modules/activities/shared/courses/planned";
import { minutesNow, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getTodayAssessments } from "@/modules/activities/shared/today/assessments";
import { getCancellationsForDay } from "@/modules/activities/shared/cancellations/data";
import { scheduleDate } from "@/modules/activities/shared/schedule/dates";
import { schedulePlacesQuery } from "@/modules/activities/features/schedule/server/queries";

export async function getSchedule(requested?: unknown, instant = new Date()) {
  const session = await requireSession();
  if (!canSee(session, "calendar")) throw new AuthorizationError("Schedule access is required.");
  const iso = scheduleDate(requested, instant), day = weekdayOfIso(iso);
  const { club } = await getCurrentClub();
  const [courses, marked, covers, assessments, cancellations, places] = await Promise.all([
    getCoursesOnDate(iso), getRegisterStateForDay(day, iso), getCoversForDay(iso),
    getTodayAssessments(iso), getCancellationsForDay(iso),
    prisma.$queryRaw<{ courseId: string; enrolled: number }[]>(schedulePlacesQuery(club.id, iso)),
  ]);
  const byCourse = new Map(places.map(row => [row.courseId, row.enrolled]));
  return {
    iso, todayIso: today(instant), initialNow: minutesNow(instant), clubId: club.id, clubName: club.name, me: session.user.id,
    assessments,
    access: { attendance: can(session, "attendance.mark"), courses: canSee(session, "courses"), assessments: canSee(session, "assessments") },
    courses: courses.map(({ id, name, startMinutes, durationMinutes, capacity, location, level, instructor, instructorId }) => ({
      id, name, startMinutes, durationMinutes, capacity, location, level, instructor, instructorId,
      enrolled: byCourse.get(id) ?? 0, cover: covers.get(id) ?? null, attendanceTaken: marked.has(id),
      cancellation: cancellations.get(id) ?? null,
    })),
  };
}
