import { cache } from "react";
import type { DayOfWeek } from "@/generated/prisma/client";
import { requireActivitiesAccess } from "@/modules/activities/classification";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getSharedCurriculum, sharedCourse, sharedPlacement, liveSharedLevel } from "@/modules/activities/lib/curriculum/data/shared";
import { prisma } from "@/lib/prisma";
import { activeStaffHolding, liveSiteIds } from "@/lib/directory";
import { withClassRefs } from "@/modules/activities/lib/courses/refs";

/** Enrolments that occupy a place. Waitlisted, withdrawn, transferred and
 *  completed rows do not. One constant so no read invents its own answer. */
export const TAKES_A_PLACE = { status: "ACTIVE" } as const;

const COURSE_SELECT = {
  id: true,
  clubId: true,
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
      // Curriculum order, so a screen grouping classes by level lists the
      // ladder top to bottom rather than alphabetically.
      sortOrder: true,
      programme: { select: { id: true, name: true, sortOrder: true } },
    },
  },
  _count: { select: { enrolments: { where: TAKES_A_PLACE } } },
} as const;


export async function getCourses(includeArchived = false, allSites = false) {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  const rows = await withClassRefs(await prisma.course.findMany({
    where: { ...(allSites ? { clubId: { in: await liveSiteIds() } } : { clubId: await currentClubId() }), ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
    select: COURSE_SELECT,
  }));
  // The directory includes historical curriculum; enrolment pickers still
  // exclude retired levels when requesting active classes across sites.
  return rows.filter(row => !allSites || includeArchived || liveSharedLevel(curriculum, row.levelId)).map(row => sharedCourse(row, curriculum));
}

export type CourseRow = Awaited<ReturnType<typeof getCourses>>[number];

/** Cached per request, so a class page's tab title and its body share one read. */
export const getCourse = cache(async function getCourse(id: string) {
  await requireSession();

  const found = await prisma.course.findUnique({ where: { id }, select: COURSE_SELECT });
  const row = found ? (await withClassRefs([found]))[0] : null;
  return row ? sharedCourse(row, await getSharedCurriculum()) : null;
});

export type CourseDetail = NonNullable<Awaited<ReturnType<typeof getCourse>>>;

/** The classes that run on a given weekday, in the order they run. The deck
 *  screen's whole query. */
export async function getCoursesOnDay(dayOfWeek: DayOfWeek, instructorId?: string) {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  const rows = await withClassRefs(await prisma.course.findMany({
    where: {
      clubId: await currentClubId(),
      dayOfWeek,
      archivedAt: null,
      ...(instructorId ? { instructorId } : {}),
    },
    orderBy: [{ startMinutes: "asc" }],
    select: COURSE_SELECT,
  }));
  return rows.map(row => sharedCourse(row, curriculum));
}

/** The roster: who is in this class, and on what footing. It flags medical
 *  notes without carrying them; the register and profile show the text to the
 *  surfaces allowed to see it. */
export async function getRoster(courseId: string) {
  await requireActivitiesAccess();
  const curriculum = await getSharedCurriculum();

  const rows = await prisma.enrolment.findMany({
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
      scheduledEndOn: true,
      placementReason: true,
      level: { select: { id: true, name: true } },
      programme: { select: { id: true, name: true } },
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberNumber: true,
          dateOfBirth: true,
          medicalNotes: true,
          status: true,
        },
      },
    },
  });
  return rows.map(row => {
    const { medicalNotes, ...student } = row.student;
    return sharedPlacement({ ...row, student: { ...student, hasMedicalNotes: !!medicalNotes?.trim() } }, curriculum);
  });
}

export type RosterEntry = Awaited<ReturnType<typeof getRoster>>[number];

/** Who a class can be assigned to: anyone whose role lets them take a
 *  register. Asked by permission rather than by role name, because roles are
 *  the club's to invent — and an account that cannot take a register has no
 *  business being the name on one. */
export async function getInstructorOptions() {
  await requireSession();

  return activeStaffHolding(["attendance.mark", "attendance.markAny"]);
}

export type InstructorOption = Awaited<ReturnType<typeof getInstructorOptions>>[number];
