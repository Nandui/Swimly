import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Everything a student is in, or has been in — newest first, open ones on
 *  top. The profile's middle section. */
export async function getEnrolmentsForStudent(studentId: string) {
  await requireSession();

  return prisma.enrolment.findMany({
    where: { studentId },
    orderBy: [{ status: "asc" }, { startedOn: "desc" }],
    select: {
      id: true,
      status: true,
      startedOn: true,
      endedOn: true,
      placementReason: true,
      programmeId: true,
      levelId: true,
      level: { select: { id: true, name: true, sortOrder: true } },
      programme: { select: { id: true, name: true } },
      course: {
        select: {
          id: true,
          name: true,
          dayOfWeek: true,
          startMinutes: true,
          durationMinutes: true,
          archivedAt: true,
          level: { select: { name: true } },
          instructor: { select: { name: true } },
        },
      },
    },
  });
}

export type StudentEnrolment = Awaited<ReturnType<typeof getEnrolmentsForStudent>>[number];

/** Courses a student could be moved into: live, and not the one they are in. */
export async function getTransferTargets(excludeCourseId: string) {
  await requireSession();

  return prisma.course.findMany({
    where: { archivedAt: null, id: { not: excludeCourseId } },
    orderBy: [{ dayOfWeek: "asc" }, { startMinutes: "asc" }],
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      capacity: true,
      level: { select: { name: true } },
      _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
    },
  });
}

export type TransferTarget = Awaited<ReturnType<typeof getTransferTargets>>[number];
