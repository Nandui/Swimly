import type { AttendanceStatus, DayOfWeek } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { savedRegister } from "@/lib/attendance/revision";
import { getSharedCurriculum, sharedCourse } from "@/lib/curriculum/data/shared";

export type RegisterLine = {
  studentId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  medicalNotes: string | null;
  levelName: string;
  /** Null means nobody has marked them yet, which is different from absent. */
  status: AttendanceStatus | null;
  note: string | null;
  /** On the register only because they were marked on it before — they have
   *  since left the class. Shown, so an old register stays saveable. */
  offRoster: boolean;
};

/** Who should be on this register, and what is already recorded.
 *
 *  The roster is *active enrolments covering that date* ∪ *students who already
 *  have a row for it*. The second half is what keeps a transferred swimmer's
 *  past register saveable instead of silently dropping them off it. */
export async function getRegister(courseId: string, iso: string) {
  await requireSession();
  const date = parseDateOnly(iso);

  const [enrolments, existing, note, curriculum] = await Promise.all([
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
      where: { courseId, date },
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
  ]);

  const lines = new Map<string, RegisterLine>();

  for (const enrolment of enrolments) {
    lines.set(enrolment.student.id, {
      studentId: enrolment.student.id,
      ...enrolment.student,
      levelName: curriculum.level(enrolment.level.id)?.name ?? enrolment.level.name,
      status: null,
      note: null,
      offRoster: false,
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
        ...record.student,
        levelName: "",
        status: record.status,
        note: record.note,
        offRoster: true,
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

export type Register = Awaited<ReturnType<typeof getRegister>>;

/** A student's attendance, newest first, for their profile. */
export async function getAttendanceForStudent(studentId: string, take = 30) {
  await requireSession();

  const rows = await prisma.attendanceRecord.findMany({
    where: { studentId },
    orderBy: { date: "desc" },
    take,
    select: {
      id: true,
      date: true,
      status: true,
      note: true,
      course: {
        select: {
          id: true,
          name: true,
          dayOfWeek: true,
          startMinutes: true, club: { select: { id: true, name: true } },
          level: { select: { id: true, name: true } },
        },
      },
    },
  });
  const curriculum = await getSharedCurriculum();
  return rows.map(row => ({ ...row, course: sharedCourse(row.course, curriculum) }));
}

export type StudentAttendance = Awaited<ReturnType<typeof getAttendanceForStudent>>[number];

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
