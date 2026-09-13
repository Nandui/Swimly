import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { AuthorizationError, can, canSee, requireSession } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { getCoursesOnDay } from "@/lib/courses/data/courses";
import { minutesNow, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { getTodayAssessments } from "@/lib/today/assessments";
import { getCancellationsForDay } from "@/lib/cancellations/data";
import { scheduleDate } from "./dates";
import { schedulePlacesQuery } from "./queries";

export async function getSchedule(requested?: unknown, instant = new Date()) {
  const session = await requireSession();
  if (!canSee(session, "calendar")) throw new AuthorizationError("Schedule access is required.");
  const iso = scheduleDate(requested, instant), day = weekdayOfIso(iso);
  const { club } = await getCurrentClub();
  const [courses, marked, covers, assessments, cancellations, places] = await Promise.all([
    getCoursesOnDay(day), getRegisterStateForDay(day, iso), getCoversForDay(iso),
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
