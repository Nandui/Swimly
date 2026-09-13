import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getCoursesOnDay } from "@/lib/courses/data/courses";
import { getCoversForDay } from "@/lib/attendance/data/cover";
import { getRegisterStateForDay } from "@/lib/attendance/data/register";
import { courseName } from "@/lib/courses/constants";
import { parseDateOnly } from "@/lib/format";
import { weekdayOfIso } from "@/lib/attendance/dates";
import { prisma } from "@/lib/prisma";
import { fullName } from "@/lib/students/constants";

export async function getDutyClasses(iso: string) {
  const session = await requireSession();
  if (!canSee(session, "duty")) throw new AuthorizationError("Duty manager access is required.");
  const date = parseDateOnly(iso), day = weekdayOfIso(iso), clubId = await currentClubId();
  const [courses, covers, marked, cancellations, enrolments, pending] = await Promise.all([
    getCoursesOnDay(day), getCoversForDay(iso), getRegisterStateForDay(day, iso),
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
      cancellation: cancellation ? { reason: cancellation.reason, id: cancellation.id } : null,
      swimmers: [...new Map(roster.map(s => [s.id, s])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    };
  }) };
}

export type DutyClass = Awaited<ReturnType<typeof getDutyClasses>>["courses"][number];
