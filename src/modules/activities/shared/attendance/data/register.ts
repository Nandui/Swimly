import type { AttendanceStatus, DayOfWeek } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { classifyMedical, medicalAllowed, requireActivitiesAccess, type SwimmerAudience } from "@/modules/activities/shared/classification";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { savedRegister } from "@/modules/activities/shared/attendance/revision";
import { getSharedCurriculum } from "@/modules/activities/shared/curriculum/data/shared";
import { mergedSwimmers } from "@/modules/activities/shared/merges/data";

const SWIMMER = { id: true, firstName: true, lastName: true, dateOfBirth: true, medicalNotes: true } as const;

export type RegisterLine = {
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  /** Null unless this audience may see medical notes (see classification). */
  medicalNotes: string | null;
  hasMedicalNotes: boolean;
  levelName: string;
  /** Null means nobody has marked them yet, which is different from absent. */
  status: AttendanceStatus | null;
  note: string | null;
  /** On the register only because they were marked on it before — they have
   *  since left the class. Shown, so an old register stays saveable. */
  offRoster: boolean;
  /** The class they belong to, when they joined this one for the day by a merge. Their
   *  attendance is saved against that class. */
  mergedFrom: string | null;
};

/** Who should be on this register, and what is already recorded.
 *
 *  The roster is *active enrolments covering that date* ∪ *students who already
 *  have a row for it*. The second half is what keeps a transferred swimmer's
 *  past register saveable instead of silently dropping them off it. */
export async function getRegister(courseId: string, iso: string, audience: SwimmerAudience = "desk") {
  const session = await requireActivitiesAccess();
  const medical = medicalAllowed(session, audience);
  const date = parseDateOnly(iso);
  // Swimmers merged in for the day: their marks live on their own class's register rows.
  const merged = await mergedSwimmers(prisma, courseId, date);
  const mergedRows = [...merged].map(([studentId, from]) => ({ courseId: from.courseId, studentId }));

  const [enrolments, existing, note, curriculum, guests] = await Promise.all([
    prisma.enrolment.findMany({
      where: {
        courseId,
        // Historical terminal statuses do not preserve whether the place
        // started on a waitlist. Saved attendance is the reliable history.
        status: "ACTIVE",
        startedOn: { lte: date },
        OR: [{ endedOn: null }, { endedOn: { gte: date } }],
      },
      select: {
        level: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            medicalNotes: true,
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: { date, OR: [{ courseId }, ...mergedRows] },
      select: {
        status: true,
        note: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            medicalNotes: true,
          },
        },
      },
    }),
    prisma.classNote.findUnique({
      where: { courseId_date: { courseId, date } },
      select: { note: true, byName: true },
    }),
    getSharedCurriculum(),
    merged.size ? prisma.enrolment.findMany({
      where: { OR: mergedRows, status: "ACTIVE" },
      select: { courseId: true, level: { select: { id: true, name: true } }, student: { select: SWIMMER } },
    }) : [],
  ]);

  const lines = new Map<string, RegisterLine>();

  for (const enrolment of enrolments) {
    lines.set(enrolment.student.id, {
      studentId: enrolment.student.id,
      ...classifyMedical(enrolment.student, medical),
      levelName: curriculum.level(enrolment.level.id)?.name ?? enrolment.level.name,
      status: null,
      note: null,
      offRoster: false,
      mergedFrom: null,
    });
  }

  for (const guest of guests) {
    // Someone in both classes stays on this register as one of its own.
    if (lines.has(guest.student.id) || merged.get(guest.student.id)?.courseId !== guest.courseId) continue;
    lines.set(guest.student.id, {
      studentId: guest.student.id,
      ...classifyMedical(guest.student, medical),
      levelName: curriculum.level(guest.level.id)?.name ?? guest.level.name,
      status: null,
      note: null,
      offRoster: false,
      mergedFrom: merged.get(guest.student.id)!.className,
    });
  }

  for (const record of existing) {
    const line = lines.get(record.student.id);
    if (line) {
      line.status = record.status;
      line.note = record.note;
    } else {
      lines.set(record.student.id, {
        studentId: record.student.id,
        ...classifyMedical(record.student, medical),
        levelName: "",
        status: record.status,
        note: record.note,
        offRoster: true,
        mergedFrom: null,
      });
    }
  }

  const ordered = [...lines.values()].sort(
    (a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );

  const saved = savedRegister(courseId, iso, existing.map(row => ({
    studentId: row.student.id, status: row.status, note: row.note,
  })), note?.note);
  return { lines: ordered, taken: existing.length > 0, note, revision: saved.revision };
}

/** Which of today's classes already have a register, so the deck screen can
 *  say what is still outstanding. */
export async function getRegisterStateForDay(dayOfWeek: DayOfWeek, iso: string) {
  await requireSession();
  const date = parseDateOnly(iso);

  const marked = await prisma.attendanceRecord.groupBy({
    by: ["courseId"],
    where: { date, course: { dayOfWeek, clubId: await currentClubId() } },
    _count: { _all: true },
  });

  return new Map(marked.map((row) => [row.courseId, row._count._all]));
}
