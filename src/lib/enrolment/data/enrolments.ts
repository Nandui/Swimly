import { requireSession } from "@/lib/authz";
import { getSharedCurriculum, sharedCourse, sharedPlacement, liveSharedLevel } from "@/lib/curriculum/data/shared";
import { prisma } from "@/lib/prisma";

/** Everything a student is in, or has been in — newest first, open ones on
 *  top. The profile's middle section. */
export async function getEnrolmentsForStudent(studentId: string) {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  const rows = await prisma.enrolment.findMany({
    where: { studentId },
    orderBy: [{ status: "asc" }, { startedOn: "desc" }],
    select: {
      id: true,
      status: true,
      startedOn: true,
      endedOn: true,
      scheduledEndOn: true,
      placementReason: true,
      programmeId: true,
      levelId: true,
      level: { select: { id: true, name: true, sortOrder: true } },
      programme: { select: { id: true, name: true } },
      course: {
        select: {
          id: true,
          name: true,
          club: { select: { id: true, name: true } },
          dayOfWeek: true,
          startMinutes: true,
          durationMinutes: true,
          archivedAt: true,
          level: { select: { id: true, name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
  });
  return rows.map(row => ({ ...sharedPlacement(row, curriculum), course: sharedCourse(row.course, curriculum) }));
}

export type StudentEnrolment = Awaited<ReturnType<typeof getEnrolmentsForStudent>>[number];

/** Courses a student could be moved into: live, and not the one they are in. */
export async function getTransferTargets(excludeCourseId?: string) {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  const rows = await prisma.course.findMany({
    where: { club: { archivedAt: null }, archivedAt: null, ...(excludeCourseId ? { id: { not: excludeCourseId } } : {}) },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
    select: {
      id: true,
      name: true,
      clubId: true,
      club: { select: { id: true, name: true } },
      dayOfWeek: true,
      startMinutes: true,
      capacity: true,
      level: { select: { id: true, name: true } },
      _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
    },
  });
  return rows.filter(row => liveSharedLevel(curriculum, row.level.id)).map(row => sharedCourse(row, curriculum));
}

export type TransferTarget = Awaited<ReturnType<typeof getTransferTargets>>[number];
