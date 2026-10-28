import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getCoursesOnDate } from "@/modules/activities/shared/courses/planned";
import { getCoversForDay } from "@/modules/activities/shared/attendance/data/cover";
import { getRegisterStateForDay } from "@/modules/activities/shared/attendance/data/register";
import { courseName } from "@/modules/activities/shared/courses/constants";
import { isDateOnly, minutesNow, parseDateOnly, today } from "@/lib/format";
import { inCancelWindow, undoBlocker } from "@/modules/activities/shared/cancellations/window";

/** The day Duty manager shows: today, or a requested day up to four weeks ahead. */
export function dutyDate(requested: unknown, todayIso: string) {
  return isDateOnly(requested) && inCancelWindow(requested, todayIso) ? requested : todayIso;
}
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/modules/activities/shared/students/constants";

/** One day's classes at the selected site: today, or a day up to four weeks ahead. */
export async function getDutyClasses(iso: string, instant = new Date()) {
  const session = await requireSession();
  if (!canSee(session, "duty")) throw new AuthorizationError("Duty manager access is required.");
  const date = parseDateOnly(iso), day = weekdayOfIso(iso), clubId = await currentClubId();
  const [courses, covers, marked, cancellations, enrolments, pending] = await Promise.all([
    getCoursesOnDate(iso), getCoversForDay(iso), getRegisterStateForDay(day, iso),
    prisma.classCancellation.findMany({ where: { clubId, date }, include: { swimmers: true } }),
    prisma.enrolment.findMany({ where: {
      course: { clubId, dayOfWeek: day, archivedAt: null }, status: "ACTIVE", startedOn: { lte: date },
      AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
    }, select: { courseId: true, student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } }),
    prisma.classCancellation.count({ where: { clubId, billingNotifiedAt: null } }),
  ]);
  return { pending, courses: courses.map(course => {
    const cancellation = cancellations.find(row => row.courseId === course.id);
    const roster = cancellation ? cancellation.swimmers.map(s => ({ id: s.studentId, name: s.swimmerName, memberNumber: s.memberNumber }))
      : enrolments.filter(row => row.courseId === course.id).map(row => ({ id: row.student.id, name: fullName(row.student), memberNumber: row.student.memberNumber }));
    return { id: course.id, name: courseName(course), level: course.level.name, programme: course.level.programme.name,
      startMinutes: course.startMinutes, durationMinutes: course.durationMinutes, capacity: course.capacity,
      location: course.location, instructor: covers.get(course.id)?.coverByName ?? course.instructor?.name ?? null,
      started: covers.has(course.id), attendanceRecorded: marked.get(course.id) ?? 0,
      cancellation: cancellation ? { reason: cancellation.reason, id: cancellation.id, closureId: cancellation.closureId,
        // The undo action checks again under the lock; this only decides whether to offer it.
        undoable: !undoBlocker(cancellation, today(instant), minutesNow(instant), covers.has(course.id)) } : null,
      swimmers: [...new Map(roster.map(s => [s.id, s])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }) };
}

export type DutyClass = Awaited<ReturnType<typeof getDutyClasses>>["courses"][number];
