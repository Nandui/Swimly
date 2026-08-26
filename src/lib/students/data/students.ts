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
};

/** The list. Three set-based queries joined in memory rather than one query per
 *  row — the placement lookup is the part that would otherwise go N+1. */
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

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: LIST_SELECT,
    take: 500,
  });

  if (students.length === 0) return [] as StudentRow[];

  const placements = await prisma.enrolment.findMany({
    where: { studentId: { in: students.map((s) => s.id) }, status: "ACTIVE" },
    select: {
      studentId: true,
      programmeId: true,
      levelId: true,
      programme: { select: { name: true } },
      level: { select: { name: true } },
    },
  });

  const byStudent = new Map<string, StudentRow["placements"]>();
  for (const placement of placements) {
    const list = byStudent.get(placement.studentId) ?? [];
    list.push({
      programmeId: placement.programmeId,
      programmeName: placement.programme.name,
      levelId: placement.levelId,
      levelName: placement.level.name,
    });
    byStudent.set(placement.studentId, list);
  }

  return students.map((student) => ({
    ...student,
    placements: byStudent.get(student.id) ?? [],
  }));
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
