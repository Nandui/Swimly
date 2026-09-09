import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getStudentProgress } from "@/lib/progression/data/progress";
import { parseDateOnly, today } from "@/lib/format";
import { HOLDS_A_PLACE } from "@/lib/assessments/constants";
import { prisma } from "@/lib/prisma";

/** Only the selected swimmer and their open places cross into the desk view.
 *  Scope both sides of the relationship before reading any personal details. */
export async function getReceptionSwimmer(id: string) {
  await requireSession();
  const clubId = await currentClubId();
  const student = await prisma.student.findFirst({
    where: { id, clubId },
    select: {
      id: true, firstName: true, lastName: true, memberNumber: true,
      dateOfBirth: true, status: true,
      contactName: true, contactPhone: true, contactEmail: true, medicalNotes: true, notes: true,
      assessmentBookings: { where: { status: { in: HOLDS_A_PLACE } }, select: { id: true, session: { select: { id: true, date: true, startMinutes: true, programme: { select: { name: true } } } } }, orderBy: { session: { date: "desc" } }, take: 5 },
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
  return student ? { ...student, progress: await getStudentProgress(id) } : null;
}

export type ReceptionSwimmer = NonNullable<Awaited<ReturnType<typeof getReceptionSwimmer>>>;

export async function getReceptionAssessments() {
  await requireSession();
  return prisma.assessmentSession.findMany({ where: { clubId: await currentClubId(), cancelledAt: null, date: { gte: parseDateOnly(today()) } }, orderBy: [{ date: "asc" },{ startMinutes: "asc" }], take: 100, select: { id: true, date: true, startMinutes: true, capacity: true, programme: { select: { name: true } }, _count: { select: { bookings: { where: { status: { in: HOLDS_A_PLACE } } } } } } });
}
export type ReceptionAssessment = Awaited<ReturnType<typeof getReceptionAssessments>>[number];
