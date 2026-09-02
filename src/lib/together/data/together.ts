import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import type { FamilyMember } from "@/lib/together/match";

/** The children somebody is trying to get into the pool on one trip.
 *
 *  **The group is chosen, not detected.** Brothers and sisters are the common
 *  case, but two friends who want to come together are the same question and
 *  the app has no way of knowing they are friends. So the list is built by
 *  hand, one swimmer at a time, and nothing is assumed about why they belong
 *  together.
 *
 *  Shared contact details are then offered as a **suggestion** rather than used
 *  as the mechanism: when the club's export put the same parent's email and
 *  mobile on several children, saying so saves typing. It is a shortcut into
 *  the list, and being wrong about it costs nothing, because the list is still
 *  whatever somebody put in it.
 *
 *  Matched exactly, not fuzzily. Siblings share those values because they came
 *  from one parent record in one export, so exact is both correct and an index
 *  lookup, where fuzzy would invent relationships that are not there. */

const STUDENT_SELECT = {
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
} as const satisfies Prisma.StudentSelect;

/** Derived from the select rather than written out, so the two cannot drift. */
type Row = Prisma.StudentGetPayload<{ select: typeof STUDENT_SELECT }>;

export type TogetherStudent = {
  id: string;
  name: string;
  dateOfBirth: Date | null;
  levelId: string | null;
  levelName: string | null;
  currentCourseIds: string[];
};

export type Suggestion = TogetherStudent & {
  /** Whose details they share, and which — so the offer explains itself. */
  sharesWith: string;
  by: ("email" | "phone")[];
};

/** How many the suggestion will offer. A contact shared by more than a
 *  handful is an address rather than a household — a school, a childminder. */
const SUGGESTION_CAP = 10;

function shape(row: Row): TogetherStudent {
  // A swimmer in two programmes has two levels. The first by curriculum order
  // is the one to search on.
  const placement = [...row.enrolments].sort((a, b) => a.level.sortOrder - b.level.sortOrder)[0];
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`,
    dateOfBirth: row.dateOfBirth,
    levelId: placement?.levelId ?? null,
    levelName: placement?.level.name ?? null,
    currentCourseIds: row.enrolments.map((e) => e.courseId),
  };
}

export async function getGroup(ids: string[]): Promise<{
  chosen: TogetherStudent[];
  suggestions: Suggestion[];
}> {
  await requireSession();
  if (ids.length === 0) return { chosen: [], suggestions: [] };

  const rows = await prisma.student.findMany({
    where: { id: { in: ids } },
    select: STUDENT_SELECT,
  });

  // Back into the order they were added, which is the order somebody typed
  // them and therefore the order they expect to read them in.
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id)).filter((row): row is Row => Boolean(row));

  const emails = [...new Set(ordered.map((r) => r.contactEmail?.trim()).filter(Boolean))] as string[];
  const phones = [...new Set(ordered.map((r) => r.contactPhone?.trim()).filter(Boolean))] as string[];

  const nearby =
    emails.length || phones.length
      ? await prisma.student.findMany({
          where: {
            // A sibling at the other site is a different trip to the pool.
            clubId: await currentClubId(),
            status: "ACTIVE",
            id: { notIn: ids },
            OR: [
              ...(emails.length ? [{ contactEmail: { in: emails } }] : []),
              ...(phones.length ? [{ contactPhone: { in: phones } }] : []),
            ],
          },
          orderBy: [{ dateOfBirth: "asc" }, { firstName: "asc" }],
          select: STUDENT_SELECT,
          take: SUGGESTION_CAP,
        })
      : [];

  const suggestions: Suggestion[] = nearby.map((row) => {
    const by: ("email" | "phone")[] = [];
    const match = ordered.find(
      (chosen) =>
        (chosen.contactEmail?.trim() && chosen.contactEmail.trim() === row.contactEmail?.trim()) ||
        (chosen.contactPhone?.trim() && chosen.contactPhone.trim() === row.contactPhone?.trim())
    );
    if (match?.contactEmail?.trim() && match.contactEmail.trim() === row.contactEmail?.trim()) {
      by.push("email");
    }
    if (match?.contactPhone?.trim() && match.contactPhone.trim() === row.contactPhone?.trim()) {
      by.push("phone");
    }
    return {
      ...shape(row),
      sharesWith: match ? `${match.firstName} ${match.lastName}` : "",
      by,
    };
  });

  return { chosen: ordered.map(shape), suggestions };
}

export function toMembers(students: TogetherStudent[]): FamilyMember[] {
  return students.map((student) => ({
    studentId: student.id,
    name: student.name,
    levelId: student.levelId,
    levelName: student.levelName,
    currentCourseIds: student.currentCourseIds,
  }));
}
