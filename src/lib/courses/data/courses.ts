import type { DayOfWeek } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Enrolments that occupy a place. Waitlisted, withdrawn, transferred and
 *  completed rows do not. One constant so no read invents its own answer. */
export const TAKES_A_PLACE = { status: "ACTIVE" } as const;

const COURSE_SELECT = {
  id: true,
  name: true,
  dayOfWeek: true,
  startMinutes: true,
  durationMinutes: true,
  capacity: true,
  location: true,
  archivedAt: true,
  levelId: true,
  instructorId: true,
  level: {
    select: {
      id: true,
      name: true,
      programme: { select: { id: true, name: true } },
    },
  },
  instructor: { select: { id: true, name: true } },
  _count: { select: { enrolments: { where: TAKES_A_PLACE } } },
} as const;

export async function getCourses(includeArchived = false) {
  await requireSession();

  return prisma.course.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
    select: COURSE_SELECT,
  });
}

export type CourseRow = Awaited<ReturnType<typeof getCourses>>[number];

export async function getCourse(id: string) {
  await requireSession();

  return prisma.course.findUnique({ where: { id }, select: COURSE_SELECT });
}

export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourse>>>;

/** The classes that run on a given weekday, in the order they run. The deck
 *  screen's whole query. */
export async function getCoursesOnDay(dayOfWeek: DayOfWeek, instructorId?: string) {
  await requireSession();

  return prisma.course.findMany({
    where: {
      dayOfWeek,
      archivedAt: null,
      ...(instructorId ? { instructorId } : {}),
    },
    orderBy: [{ startMinutes: "asc" }],
    select: COURSE_SELECT,
  });
}

/** The roster: who is in this class, and on what footing. */
export async function getRoster(courseId: string) {
  await requireSession();

  return prisma.enrolment.findMany({
    where: { courseId, status: { in: ["ACTIVE", "WAITLISTED"] } },
    orderBy: [
      { status: "asc" },
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
    select: {
      id: true,
      status: true,
      startedOn: true,
      placementReason: true,
      level: { select: { id: true, name: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          dateOfBirth: true,
          medicalNotes: true,
          status: true,
        },
      },
    },
  });
}

export type RosterEntry = Awaited<ReturnType<typeof getRoster>>[number];

export async function getCourseCounts() {
  await requireSession();

  const [courses, places] = await Promise.all([
    prisma.course.count({ where: { archivedAt: null } }),
    prisma.enrolment.count({ where: { ...TAKES_A_PLACE, course: { archivedAt: null } } }),
  ]);

  return { courses, places };
}

/** Who a class can be assigned to: anyone whose role lets them take a
 *  register. Asked by permission rather than by role name, because roles are
 *  the club's to invent — and an account that cannot take a register has no
 *  business being the name on one. */
export async function getInstructorOptions() {
  await requireSession();

  return prisma.user.findMany({
    where: {
      isActive: true,
      staffRole: { permissions: { hasSome: ["attendance.mark", "attendance.markAny"] } },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export type InstructorOption = Awaited<ReturnType<typeof getInstructorOptions>>[number];
