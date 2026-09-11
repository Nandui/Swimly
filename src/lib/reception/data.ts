import { requireSession } from "@/lib/authz";
import { getSharedCurriculum, sharedCourse, sharedPlacement, liveSharedLevel } from "@/lib/curriculum/data/shared";
import { prisma } from "@/lib/prisma";

/** Only the selected swimmer and their open places cross into the desk view.
 *  Swimmer identity and open places are shared across sites. */
export async function getReceptionSwimmer(id: string) {
  await requireSession();
  const curriculum = await getSharedCurriculum();
  const row = await prisma.student.findFirst({
    where: { id },
    select: {
      id: true, firstName: true, lastName: true, memberNumber: true,
      dateOfBirth: true, status: true,
      contactName: true, contactPhone: true, contactEmail: true,
      enrolments: {
        where: { status: { in: ["ACTIVE", "WAITLISTED"] } },
        orderBy: [{ status: "asc" }, { course: { startMinutes: "asc" } }],
        select: {
          id: true, status: true, scheduledEndOn: true,
          level: { select: { id: true, name: true } },
          programme: { select: { id: true, name: true } },
          course: { select: {
            id: true, name: true, clubId: true, club: { select: { id: true, name: true } }, dayOfWeek: true, startMinutes: true,
            durationMinutes: true, location: true, archivedAt: true,
            level: { select: { id: true, name: true, programme: { select: { id: true, name: true } } } },
            instructor: { select: { name: true } },
          } },
        },
      },
    },
  });
  return row ? { ...row, enrolments: row.enrolments.map(e => ({ ...sharedPlacement(e, curriculum), course: sharedCourse(e.course, curriculum) })) } : null;
}

export type ReceptionSwimmer = NonNullable<Awaited<ReturnType<typeof getReceptionSwimmer>>>;

/** A weekly availability read, independent of today's register. Never send
 *  rosters or personal details to the finder. Archived curriculum cannot be
 *  a new placement; existing places remain visible on the swimmer sheet. */
export async function getReceptionClassOptions() {
  await requireSession();
  const curriculum = await getSharedCurriculum();
  const rows = await prisma.course.findMany({
    where: { club: { archivedAt: null }, archivedAt: null },
    select: {
      id: true, name: true, clubId: true, club: { select: { id: true, name: true } }, dayOfWeek: true, startMinutes: true,
      durationMinutes: true, location: true, capacity: true,
      instructor: { select: { name: true } },
      level: { select: { id: true, name: true, sortOrder: true,
        programme: { select: { id: true, name: true, sortOrder: true } } } },
      _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
    },
  });
  return rows.filter(row => liveSharedLevel(curriculum, row.level.id)).map(row => sharedCourse(row, curriculum));
}

export type ReceptionClassOption = Awaited<ReturnType<typeof getReceptionClassOptions>>[number];
