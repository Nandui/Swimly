import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";

/** Only the selected swimmer and their open places cross into the desk view.
 *  Scope both sides of the relationship before reading any personal details. */
export async function getReceptionSwimmer(id: string) {
  await requireSession();
  const clubId = await currentClubId();
  return prisma.student.findFirst({
    where: { id, clubId },
    select: {
      id: true, firstName: true, lastName: true, memberNumber: true,
      dateOfBirth: true, status: true,
      contactName: true, contactPhone: true, contactEmail: true,
      enrolments: {
        where: { status: { in: ["ACTIVE", "WAITLISTED"] }, course: { clubId } },
        orderBy: [{ status: "asc" }, { course: { startMinutes: "asc" } }],
        select: {
          id: true, status: true, scheduledEndOn: true,
          level: { select: { id: true, name: true } },
          programme: { select: { id: true, name: true } },
          course: { select: {
            id: true, name: true, dayOfWeek: true, startMinutes: true,
            durationMinutes: true, location: true, archivedAt: true,
            level: { select: { id: true, name: true, programme: { select: { id: true, name: true } } } },
            instructor: { select: { name: true } },
          } },
        },
      },
    },
  });
}

export type ReceptionSwimmer = NonNullable<Awaited<ReturnType<typeof getReceptionSwimmer>>>;

/** A weekly availability read, independent of today's register. Never send
 *  rosters or personal details to the finder. Archived curriculum cannot be
 *  a new placement; existing places remain visible on the swimmer sheet. */
export async function getReceptionClassOptions() {
  await requireSession();
  const clubId = await currentClubId();
  return prisma.course.findMany({
    where: { clubId, archivedAt: null, level: { archivedAt: null, programme: { archivedAt: null } } },
    select: {
      id: true, name: true, dayOfWeek: true, startMinutes: true,
      durationMinutes: true, location: true, capacity: true,
      instructor: { select: { name: true } },
      level: { select: { id: true, name: true, sortOrder: true,
        programme: { select: { id: true, name: true, sortOrder: true } } } },
      _count: { select: { enrolments: { where: { status: "ACTIVE" } } } },
    },
  });
}

export type ReceptionClassOption = Awaited<ReturnType<typeof getReceptionClassOptions>>[number];
