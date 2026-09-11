import type { Prisma } from "@/generated/prisma/client";
import { HOLDS_A_PLACE } from "@/lib/assessments/constants";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";
import { getProgrammes } from "@/lib/curriculum/data/curriculum";
import { prisma } from "@/lib/prisma";

/** Reads for assessment sessions and bookings. Writes live in `../actions/`.
 *  The lists are the current club's; a session fetched by id is not filtered,
 *  and the page checks whose it is. */

const SESSION_SELECT = {
  id: true,
  clubId: true,
  club: { select: { id: true, name: true } },
  date: true,
  startMinutes: true,
  durationMinutes: true,
  location: true,
  capacity: true,
  notes: true,
  cancelledAt: true,
  programmeId: true,
  programme: { select: { id: true, name: true } },
  typeId: true,
  type: { select: { id: true, name: true } },
  instructorId: true,
  instructor: { select: { id: true, name: true } },
  _count: { select: { bookings: { where: { status: { in: HOLDS_A_PLACE } } } } },
} as const satisfies Prisma.AssessmentSessionSelect;

export type SessionRow = Prisma.AssessmentSessionGetPayload<{ select: typeof SESSION_SELECT }>;

/** Every session, oldest first. Few enough that the page splits them into
 *  upcoming, past and cancelled itself rather than asking three times. */
export async function getAssessmentSessions(): Promise<SessionRow[]> {
  await requireSession();

  const rows = await prisma.assessmentSession.findMany({
    where: { clubId: await currentClubId() },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: SESSION_SELECT,
  });
  const curriculum = await getSharedCurriculum();
  return rows.map(row => ({ ...row, programmeId: curriculum.programmeIds.resolve(row.programmeId), programme: { id: curriculum.programmeIds.resolve(row.programmeId), name: curriculum.programme(row.programmeId)?.name ?? row.programme.name }, typeId: row.typeId ? curriculum.typeIds.resolve(row.typeId) : null, type: row.type ? { id: curriculum.typeIds.resolve(row.type.id), name: curriculum.types.find(t => t.id === curriculum.typeIds.resolve(row.type!.id))?.name ?? row.type.name } : null }));
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

  const row = await prisma.assessmentSession.findUnique({
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
  if (!row) return null;
  const curriculum = await getSharedCurriculum();
  const programme = curriculum.programme(row.programmeId);
  return { ...row, programmeId: programme?.id ?? row.programmeId,
    programme: { ...row.programme, id: programme?.id ?? row.programme.id, name: programme?.name ?? row.programme.name,
      levels: programme?.levels.filter(l => !l.archivedAt).map(l => ({ id: l.id, name: l.name, sortOrder: l.sortOrder })) ?? [] },
    typeId: row.typeId ? curriculum.typeIds.resolve(row.typeId) : null,
    type: row.type ? { id: curriculum.typeIds.resolve(row.type.id), name: curriculum.types.find(t => t.id === curriculum.typeIds.resolve(row.type!.id))?.name ?? row.type.name } : null,
    bookings: row.bookings.map(b => ({ ...b, outcomeLevelId: b.outcomeLevelId ? curriculum.levelIds.resolve(b.outcomeLevelId) : null,
      outcomeLevel: b.outcomeLevel ? { id: curriculum.levelIds.resolve(b.outcomeLevel.id), name: curriculum.level(b.outcomeLevel.id)?.name ?? b.outcomeLevel.name } : null })),
  };
}

export type SessionDetail = NonNullable<Awaited<ReturnType<typeof getAssessmentSession>>>;

/** A swimmer's assessments, newest first, for their profile. */
export async function getStudentAssessments(studentId: string) {
  await requireSession();

  const rows = await prisma.assessmentBooking.findMany({
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
          cancelledAt: true, club: { select: { id: true, name: true } },
          programme: { select: { id: true, name: true } },
          type: { select: { id: true, name: true } },
        },
      },
    },
  });
  const curriculum = await getSharedCurriculum();
  return rows.map(row => {
    const programme = curriculum.programme(row.session.programme.id);
    const type = row.session.type
      ? curriculum.types.find(t => t.id === curriculum.typeIds.resolve(row.session.type!.id)) : null;
    const outcome = row.outcomeLevel ? curriculum.level(row.outcomeLevel.id) : null;
    return { ...row,
      outcomeLevel: outcome ? { id: outcome.id, name: outcome.name } : row.outcomeLevel,
      session: { ...row.session,
        programme: programme ? { id: programme.id, name: programme.name } : row.session.programme,
        type: type ? { id: type.id, name: type.name } : row.session.type,
      },
    };
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
  await requireSession();
  const curriculum = await getSharedCurriculum();
  const rows = await prisma.assessmentBooking.findMany({
    where: {
      studentId,
      status: "ATTENDED",
      outcomeLevelId: { not: null },
      session: { programmeId: { in: curriculum.programmeIds.variants(programmeId) } },
    },
    select: { outcomeLevelId: true },
  });
  return new Set(rows.map(row => curriculum.levelIds.resolve(row.outcomeLevelId!)));
}

/** For the session form: which programme a session assesses for. */
export async function getAssessmentProgrammeOptions() {
  await requireSession();

  return (await getProgrammes()).map(p => ({ id: p.id, name: p.name }));
}

export type ProgrammeOption = Awaited<ReturnType<typeof getAssessmentProgrammeOptions>>[number];

/** Every live kind of assessment, across programmes, so the session form can
 *  narrow the list to whichever programme is picked without another round
 *  trip. A handful of rows. */
export async function getAssessmentTypeOptions() {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  return curriculum.types.filter(t => !t.archivedAt && !curriculum.programme(t.programmeId)?.archivedAt).map(t => ({ id: t.id, name: t.name, description: t.description, programmeId: t.programmeId }));
}

export type AssessmentTypeOption = Awaited<ReturnType<typeof getAssessmentTypeOptions>>[number];

/** For the programme page: its kinds of assessment, archived ones included,
 *  each with how many sessions have been of it. */
export async function getAssessmentTypes(programmeId: string) {
  await requireSession();

  const curriculum = await getSharedCurriculum();
  return curriculum.types.filter(t => t.programmeId === curriculum.programmeIds.resolve(programmeId));
}

export type AssessmentTypeRow = Awaited<ReturnType<typeof getAssessmentTypes>>[number];
