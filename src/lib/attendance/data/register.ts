import type { AttendanceStatus, DayOfWeek } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { DROP_OFF_STREAK } from "@/lib/attendance/constants";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

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

  const [enrolments, existing, note] = await Promise.all([
    prisma.enrolment.findMany({
      where: {
        courseId,
        status: "ACTIVE",
        startedOn: { lte: date },
        OR: [{ endedOn: null }, { endedOn: { gte: date } }],
      },
      select: {
        level: { select: { name: true } },
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
  ]);

  const lines = new Map<string, RegisterLine>();

  for (const enrolment of enrolments) {
    lines.set(enrolment.student.id, {
      studentId: enrolment.student.id,
      ...enrolment.student,
      levelName: enrolment.level.name,
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

  return { lines: ordered, taken: existing.length > 0, note };
}

export type Register = Awaited<ReturnType<typeof getRegister>>;

/** A student's attendance, newest first, for their profile. */
export async function getAttendanceForStudent(studentId: string, take = 30) {
  await requireSession();

  return prisma.attendanceRecord.findMany({
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
          startMinutes: true,
          level: { select: { name: true } },
        },
      },
    },
  });
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

/** The question a swim school actually asks: who has stopped coming?
 *
 *  Three consecutive absences, most recent first. Bounded by reading only the
 *  recent tail of the table rather than all of it. */
export async function getDropOffs(limit = 8) {
  await requireSession();

  const recent = await prisma.attendanceRecord.findMany({
    where: { student: { status: "ACTIVE", clubId: await currentClubId() } },
    orderBy: { date: "desc" },
    take: 1500,
    select: {
      date: true,
      status: true,
      studentId: true,
      student: { select: { id: true, firstName: true, lastName: true } },
      course: { select: { id: true, name: true, level: { select: { name: true } } } },
    },
  });

  const byStudent = new Map<string, typeof recent>();
  for (const row of recent) {
    const list = byStudent.get(row.studentId) ?? [];
    list.push(row);
    byStudent.set(row.studentId, list);
  }

  const dropped: {
    studentId: string;
    name: string;
    missed: number;
    lastSeen: Date;
    courseName: string;
  }[] = [];

  for (const rows of byStudent.values()) {
    let streak = 0;
    for (const row of rows) {
      if (row.status === "ABSENT") streak += 1;
      else break;
    }
    if (streak < DROP_OFF_STREAK) continue;

    const first = rows[0];
    dropped.push({
      studentId: first.studentId,
      name: `${first.student.firstName} ${first.student.lastName}`,
      missed: streak,
      lastSeen: rows[streak - 1].date,
      courseName: first.course.name ?? first.course.level.name,
    });
  }

  return dropped.sort((a, b) => b.missed - a.missed).slice(0, limit);
}

export type DropOff = Awaited<ReturnType<typeof getDropOffs>>[number];
