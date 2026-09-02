import type { Prisma } from "@/generated/prisma/client";
import { HOLDS_A_PLACE } from "@/lib/assessments/constants";
import { requireSession } from "@/lib/authz";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { prisma } from "@/lib/prisma";

/** Reads for assessment sessions and bookings. Writes live in `../actions/`. */

const SESSION_SELECT = {
  id: true,
  date: true,
  startMinutes: true,
  durationMinutes: true,
  location: true,
  capacity: true,
  notes: true,
  cancelledAt: true,
  programmeId: true,
  programme: { select: { id: true, name: true } },
  instructorId: true,
  instructor: { select: { id: true, name: true } },
  _count: { select: { bookings: { where: { status: { in: HOLDS_A_PLACE } } } } },
} as const satisfies Prisma.AssessmentSessionSelect;

export type SessionRow = Prisma.AssessmentSessionGetPayload<{ select: typeof SESSION_SELECT }>;

/** Every session, oldest first. Few enough that the page splits them into
 *  upcoming, past and cancelled itself rather than asking three times. */
export async function getAssessmentSessions(): Promise<SessionRow[]> {
  await requireSession();

  return prisma.assessmentSession.findMany({
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: SESSION_SELECT,
  });
}

const BOOKING_SELECT = {
  id: true,
  status: true,
  bookedByName: true,
  createdAt: true,
  outcomeLevelId: true,
  outcomeNote: true,
  assessedByName: true,
  assessedOn: true,
  outcomeLevel: { select: { id: true, name: true } },
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      medicalNotes: true,
    },
  },
} as const satisfies Prisma.AssessmentBookingSelect;

export type BookingRow = Prisma.AssessmentBookingGetPayload<{ select: typeof BOOKING_SELECT }>;

/** One session with everyone on it, and the levels an outcome may name —
 *  the live levels of the session's own programme, and nothing else. */
export async function getAssessmentSession(id: string) {
  await requireSession();

  return prisma.assessmentSession.findUnique({
    where: { id },
    select: {
      ...SESSION_SELECT,
      programme: {
        select: {
          id: true,
          name: true,
          levels: {
            where: LIVE,
            orderBy: [...LIST_ORDER],
            select: { id: true, name: true, sortOrder: true },
          },
        },
      },
      bookings: {
        orderBy: [{ status: "asc" }, { student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        select: BOOKING_SELECT,
      },
    },
  });
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getAssessmentSession>>>;

/** A swimmer's assessments, newest first, for their profile. */
export async function getStudentAssessments(studentId: string) {
  await requireSession();

  return prisma.assessmentBooking.findMany({
    where: { studentId },
    orderBy: [{ session: { date: "desc" } }, { session: { startMinutes: "desc" } }],
    select: {
      id: true,
      status: true,
      outcomeNote: true,
      assessedByName: true,
      assessedOn: true,
      outcomeLevel: { select: { id: true, name: true } },
      session: {
        select: {
          id: true,
          date: true,
          startMinutes: true,
          cancelledAt: true,
          programme: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export type StudentAssessment = Awaited<ReturnType<typeof getStudentAssessments>>[number];

/** The levels an assessor has placed this swimmer at, in one programme. What
 *  `hasEarnedPlace` reads so an assessed child can be enrolled without a
 *  reason being demanded for a place they were judged ready for. */
export async function getAssessedLevelIds(
  studentId: string,
  programmeId: string
): Promise<Set<string>> {
  const rows = await prisma.assessmentBooking.findMany({
    where: {
      studentId,
      status: "ATTENDED",
      outcomeLevelId: { not: null },
      session: { programmeId },
    },
    select: { outcomeLevelId: true },
  });
  return new Set(rows.map((row) => row.outcomeLevelId!));
}

/** For the session form: which programme a session assesses for. */
export async function getAssessmentProgrammeOptions() {
  await requireSession();

  return prisma.programme.findMany({
    where: LIVE,
    orderBy: [...LIST_ORDER],
    select: { id: true, name: true },
  });
}

export type ProgrammeOption = Awaited<ReturnType<typeof getAssessmentProgrammeOptions>>[number];
