import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getCoursesOnDate } from "@/modules/activities/shared/courses/planned";
import { getCoversForDay } from "@/modules/activities/shared/attendance/data/cover";
import { getRegisterStateForDay } from "@/modules/activities/shared/attendance/data/register";
import { courseName } from "@/modules/activities/shared/courses/constants";
import { parseDateOnly } from "@/lib/format";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { prisma } from "@/lib/prisma";
import { getMergesForDay } from "@/modules/activities/shared/merges/data";
import { fullName } from "@/modules/activities/shared/students/constants";

export async function getDutyClasses(iso: string) {
  const session = await requireSession();
  if (!canSee(session, "duty")) throw new AuthorizationError("Duty manager access is required.");
  const date = parseDateOnly(iso), day = weekdayOfIso(iso), clubId = await currentClubId();
  const [courses, covers, marked, cancellations, enrolments, pending, merges] = await Promise.all([
    getCoursesOnDate(iso), getCoversForDay(iso), getRegisterStateForDay(day, iso),
    prisma.classCancellation.findMany({ where: { clubId, date }, include: { swimmers: true } }),
    prisma.enrolment.findMany({ where: {
      course: { clubId, dayOfWeek: day, archivedAt: null }, status: "ACTIVE", startedOn: { lte: date },
      AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
    }, select: { courseId: true, student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } }),
    prisma.classCancellation.count({ where: { clubId, billingNotifiedAt: null } }),
    getMergesForDay(iso),
  ]);
  return { pending, courses: courses.map(course => {
    const cancellation = cancellations.find(row => row.courseId === course.id);
    const roster = cancellation ? cancellation.swimmers.map(s => ({ id: s.studentId, name: s.swimmerName, memberNumber: s.memberNumber }))
      : enrolments.filter(row => row.courseId === course.id).map(row => ({ id: row.student.id, name: fullName(row.student), memberNumber: row.student.memberNumber }));
    const away = merges.away.get(course.id);
    return { id: course.id, levelId: course.levelId, name: courseName(course), level: course.level.name, programme: course.level.programme.name,
      startMinutes: course.startMinutes, durationMinutes: course.durationMinutes, capacity: course.capacity,
      location: course.location, instructor: covers.get(course.id)?.coverByName ?? course.instructor?.name ?? null,
      started: covers.has(course.id), attendanceRecorded: marked.get(course.id) ?? 0,
      cancellation: cancellation ? { reason: cancellation.reason, id: cancellation.id } : null,
      // Merged into another class today, or other classes merged into this one.
      mergedInto: away ? { id: away.id, name: away.intoClassName, startMinutes: away.intoStartMinutes, reason: away.reason } : null,
      joined: (merges.into.get(course.id) ?? []).map(row => ({ name: row.fromClassName, startMinutes: row.fromStartMinutes, swimmers: row._count.swimmers })),
      swimmers: [...new Map(roster.map(s => [s.id, s])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }) };
}

export type DutyClass = Awaited<ReturnType<typeof getDutyClasses>>["courses"][number];
