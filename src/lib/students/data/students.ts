import type { Prisma, StudentStatus } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const LIST_SELECT = {
  id: true,
  memberNumber: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  status: true,
  contactName: true,
  contactPhone: true,
} as const satisfies Prisma.StudentSelect;

export type StudentRow = Prisma.StudentGetPayload<{ select: typeof LIST_SELECT }> & {
  /** The levels this student is currently placed at, one per programme they
   *  are in. Derived, because "current level" belongs to a
   *  (student, programme) pair rather than to a student. */
  placements: { programmeId: string; programmeName: string; levelId: string; levelName: string }[];
};

export type StudentFilters = {
  q?: string;
  status?: StudentStatus | "ALL";
  levelId?: string;
  /** 1-based. */
  page?: number;
};

/** How many swimmers a page of the list holds. The club has over a thousand,
 *  and the list used to `take: 500` — which was both a third of a megabyte of
 *  payload per navigation and, quietly, a lie: swimmers 501 onwards could not
 *  be reached by any amount of scrolling. */
export const STUDENTS_PER_PAGE = 100;

/** The list. Set-based queries joined in memory rather than one query per row —
 *  the placement lookup is the part that would otherwise go N+1. */
export async function getStudents(filters: StudentFilters = {}) {
  await requireSession();

  const q = filters.q?.trim();
  const where: Prisma.StudentWhereInput = {
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { contactEmail: { contains: q, mode: "insensitive" } },
            // The club's own identifier is how staff look people up.
            { memberNumber: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.levelId
      ? { enrolments: { some: { levelId: filters.levelId, status: "ACTIVE" } } }
      : {}),
  };

  const page = Math.max(1, Math.trunc(filters.page ?? 1));

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: LIST_SELECT,
      skip: (page - 1) * STUDENTS_PER_PAGE,
      take: STUDENTS_PER_PAGE,
    }),
  ]);

  if (students.length === 0) return { students: [] as StudentRow[], total, page };

  // No nested selects here on purpose. Joining programme and level per
  // enrolment asks the database to repeat a handful of names once per row; the
  // whole curriculum is ten levels, so it is fetched once alongside and joined
  // in memory. Cold, that was the difference between 130ms and 490ms.
  const [placements, levels] = await Promise.all([
    prisma.enrolment.findMany({
      where: { studentId: { in: students.map((s) => s.id) }, status: "ACTIVE" },
      select: { studentId: true, programmeId: true, levelId: true },
    }),
    prisma.level.findMany({
      select: { id: true, name: true, programme: { select: { id: true, name: true } } },
    }),
  ]);

  const levelById = new Map(levels.map((level) => [level.id, level]));

  const byStudent = new Map<string, StudentRow["placements"]>();
  for (const placement of placements) {
    const level = levelById.get(placement.levelId);
    if (!level) continue;
    const list = byStudent.get(placement.studentId) ?? [];
    list.push({
      programmeId: placement.programmeId,
      programmeName: level.programme.name,
      levelId: placement.levelId,
      levelName: level.name,
    });
    byStudent.set(placement.studentId, list);
  }

  return {
    students: students.map((student) => ({
      ...student,
      placements: byStudent.get(student.id) ?? [],
    })),
    total,
    page,
  };
}

export async function getStudentCounts() {
  await requireSession();

  const [all, active] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),
  ]);

  return { all, active, inactive: all - active };
}

/** The profile. Medical notes come back here and nowhere in a list. */
export async function getStudent(id: string) {
  await requireSession();

  return prisma.student.findUnique({
    where: { id },
    select: {
      id: true,
      memberNumber: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      status: true,
      joinedOn: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      emergencyName: true,
      emergencyPhone: true,
      emergencyRelationship: true,
      medicalNotes: true,
      photoConsent: true,
      photoConsentOn: true,
      notes: true,
    },
  });
}

export type StudentDetail = NonNullable<Awaited<ReturnType<typeof getStudent>>>;

/** For pickers: every active student, cheap. */
export async function getStudentOptions() {
  await requireSession();

  return prisma.student.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
  });
}

export type StudentOption = Awaited<ReturnType<typeof getStudentOptions>>[number];
