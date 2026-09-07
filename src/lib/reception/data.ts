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
      enrolments: {
        where: { status: { in: ["ACTIVE", "WAITLISTED"] }, course: { clubId } },
        orderBy: [{ status: "asc" }, { course: { startMinutes: "asc" } }],
        select: {
          id: true, status: true, scheduledEndOn: true,
          level: { select: { name: true } },
          course: { select: {
            id: true, name: true, dayOfWeek: true, startMinutes: true,
            durationMinutes: true, location: true, archivedAt: true,
            level: { select: { name: true } },
            instructor: { select: { name: true } },
          } },
        },
      },
    },
  });
}

export type ReceptionSwimmer = NonNullable<Awaited<ReturnType<typeof getReceptionSwimmer>>>;
