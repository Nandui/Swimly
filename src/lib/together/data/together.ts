import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import type { FamilyMember } from "@/lib/together/match";

/** Who else belongs to this child's family.
 *
 *  There is no family table, deliberately — `DESIGN.md` chose standalone
 *  students and that decision still holds. What there is now is the club's own
 *  export, which put the same parent's email and mobile on every one of their
 *  children, byte for byte. So a family is derivable rather than modelled: the
 *  swimmers reachable on the same phone or at the same address.
 *
 *  Matched exactly, not fuzzily. Siblings share these values because they came
 *  from one parent record in one export, so exact is both correct and an index
 *  lookup. Fuzzy matching here would invent families.
 *
 *  It can still be wrong — a childminder's number, a school office address —
 *  which is why the page names what linked each child and lets somebody take
 *  one out of the group rather than trusting the guess. */

const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  contactEmail: true,
  contactPhone: true,
  enrolments: {
    where: { status: "ACTIVE" } as const,
    select: {
      courseId: true,
      levelId: true,
      level: { select: { id: true, name: true, sortOrder: true } },
    },
  },
} as const;

export type FamilyStudent = {
  id: string;
  name: string;
  dateOfBirth: Date | null;
  /** Why they were grouped: the value they share with the child you picked. */
  linkedBy: ("email" | "phone")[];
  levelId: string | null;
  levelName: string | null;
  currentCourseIds: string[];
};

/** A family is small. Anything larger is a shared address rather than a family
 *  — a school, a childminder — and searching a slot for twenty children would
 *  answer a question nobody asked. */
export const FAMILY_CAP = 10;

export async function getFamily(studentId: string): Promise<{
  anchor: FamilyStudent;
  family: FamilyStudent[];
  overflowed: boolean;
} | null> {
  await requireSession();

  const anchor = await prisma.student.findUnique({
    where: { id: studentId },
    select: MEMBER_SELECT,
  });
  if (!anchor) return null;

  const email = anchor.contactEmail?.trim() || null;
  const phone = anchor.contactPhone?.trim() || null;

  const others =
    email || phone
      ? await prisma.student.findMany({
          where: {
            status: "ACTIVE",
            id: { not: anchor.id },
            OR: [
              ...(email ? [{ contactEmail: email }] : []),
              ...(phone ? [{ contactPhone: phone }] : []),
            ],
          },
          orderBy: [{ dateOfBirth: "asc" }, { firstName: "asc" }],
          select: MEMBER_SELECT,
          take: FAMILY_CAP,
        })
      : [];

  const shape = (row: typeof anchor): FamilyStudent => {
    // A swimmer in two programmes has two levels. The first by curriculum order
    // is the one to search on; the page says so rather than picking silently.
    const placement = [...row.enrolments].sort(
      (a, b) => a.level.sortOrder - b.level.sortOrder
    )[0];
    const linkedBy: ("email" | "phone")[] = [];
    if (email && row.contactEmail?.trim() === email) linkedBy.push("email");
    if (phone && row.contactPhone?.trim() === phone) linkedBy.push("phone");

    return {
      id: row.id,
      name: `${row.firstName} ${row.lastName}`,
      dateOfBirth: row.dateOfBirth,
      linkedBy,
      levelId: placement?.levelId ?? null,
      levelName: placement?.level.name ?? null,
      currentCourseIds: row.enrolments.map((e) => e.courseId),
    };
  };

  return {
    anchor: shape(anchor),
    family: [shape(anchor), ...others.map(shape)],
    overflowed: others.length === FAMILY_CAP,
  };
}

export function toMembers(family: FamilyStudent[]): FamilyMember[] {
  return family.map((member) => ({
    studentId: member.id,
    name: member.name,
    levelId: member.levelId,
    levelName: member.levelName,
    currentCourseIds: member.currentCourseIds,
  }));
}
