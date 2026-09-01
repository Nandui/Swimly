import type { DayOfWeek } from "@/generated/prisma/client";
import { DAY_META } from "@/lib/courses/constants";
import type { CourseRow } from "@/lib/courses/data/courses";

/** Finding a time that suits a whole family.
 *
 *  Pure, and separate from the reads for the same reason `progression/rules.ts`
 *  is: the awkward part is the rule, not the query.
 *
 *  **A child only fits a class at their own level**, which is what keeps this
 *  from being a bipartite matching problem. Children partition by level, and
 *  each level's places are only contestable by children at that level, so the
 *  whole question decomposes: for every level, are there enough places at this
 *  slot for the children who need one? No search, no backtracking.
 *
 *  **A child already in a class at that slot needs no place.** Missing this
 *  makes the feature useless in the common case — a family with one child
 *  already swimming asks precisely whether the others can join them, and a
 *  full class the child is already in would otherwise rule out their own slot. */

export type FamilyMember = {
  studentId: string;
  name: string;
  /** Null when nobody has placed them yet: no level, so nothing to search for. */
  levelId: string | null;
  levelName: string | null;
  /** Classes they are already in, so a slot they already attend costs nothing. */
  currentCourseIds: string[];
};

export type Placement = {
  studentId: string;
  name: string;
  /** The class they would join, or the one they are already in. */
  course: CourseRow;
  alreadyIn: boolean;
};

export type SlotFit = {
  day: DayOfWeek;
  startMinutes: number;
  placements: Placement[];
};

export type DayFit = {
  day: DayOfWeek;
  /** Slots where every child is in the water at the same time. The best answer:
   *  one drop-off, one wait, one pick-up. */
  together: SlotFit[];
  /** Every child can swim this day, but not all at one time. The times they
   *  would be spread across, earliest first. */
  spread: Placement[] | null;
};

function placesLeft(course: CourseRow): number {
  if (course.capacity === null) return Number.POSITIVE_INFINITY;
  return Math.max(0, course.capacity - course._count.enrolments);
}

/** Hands out places within one level, largest class first so a family of three
 *  lands in one class rather than being split across three. Returns null the
 *  moment somebody cannot be seated. */
function seat(members: FamilyMember[], courses: CourseRow[]): Placement[] | null {
  const out: Placement[] = [];
  const remaining = new Map(courses.map((course) => [course.id, placesLeft(course)]));

  // Anyone already in one of these classes keeps their place and consumes
  // nothing, so they are settled before the free places are handed out.
  const needsAPlace: FamilyMember[] = [];
  for (const member of members) {
    const existing = courses.find((course) => member.currentCourseIds.includes(course.id));
    if (existing) out.push({ studentId: member.studentId, name: member.name, course: existing, alreadyIn: true });
    else needsAPlace.push(member);
  }

  for (const member of needsAPlace) {
    const best = courses
      .filter((course) => (remaining.get(course.id) ?? 0) > 0)
      .sort((a, b) => (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0))[0];
    if (!best) return null;
    remaining.set(best.id, (remaining.get(best.id) ?? 0) - 1);
    out.push({ studentId: member.studentId, name: member.name, course: best, alreadyIn: false });
  }

  return out;
}

/** Seats every member, each from the classes at their own level. */
function seatAll(members: FamilyMember[], courses: CourseRow[]): Placement[] | null {
  const byLevel = new Map<string, FamilyMember[]>();
  for (const member of members) {
    if (!member.levelId) return null;
    byLevel.set(member.levelId, [...(byLevel.get(member.levelId) ?? []), member]);
  }

  const out: Placement[] = [];
  for (const [levelId, atLevel] of byLevel) {
    const seated = seat(
      atLevel,
      courses.filter((course) => course.levelId === levelId)
    );
    if (!seated) return null;
    out.push(...seated);
  }

  // Back into the order the family was given in, so the answer reads the same
  // way down every slot.
  const order = new Map(members.map((m, i) => [m.studentId, i]));
  return out.sort((a, b) => (order.get(a.studentId) ?? 0) - (order.get(b.studentId) ?? 0));
}

export type TogetherResult = {
  days: DayFit[];
  /** Members with no level yet. Nothing can be searched for them, and saying so
   *  is better than quietly leaving them out of the answer. */
  unplaced: FamilyMember[];
};

export function findTimesTogether(
  members: FamilyMember[],
  courses: CourseRow[]
): TogetherResult {
  const unplaced = members.filter((m) => !m.levelId);
  const searchable = members.filter((m) => m.levelId);
  if (searchable.length === 0) return { days: [], unplaced };

  const live = courses.filter((course) => !course.archivedAt);
  const days = [...new Set(live.map((course) => course.dayOfWeek))].sort(
    (a, b) => DAY_META[a].index - DAY_META[b].index
  );

  const out: DayFit[] = [];

  for (const day of days) {
    const onDay = live.filter((course) => course.dayOfWeek === day);

    const together: SlotFit[] = [];
    for (const startMinutes of [...new Set(onDay.map((c) => c.startMinutes))].sort((a, b) => a - b)) {
      const placements = seatAll(
        searchable,
        onDay.filter((course) => course.startMinutes === startMinutes)
      );
      if (placements) together.push({ day, startMinutes, placements });
    }

    // Everyone can swim this day, just not all at once. Worth offering when
    // nothing lines up, worth nothing when something does.
    const spread = together.length > 0 ? null : seatAll(searchable, onDay);

    if (together.length > 0 || spread) out.push({ day, together, spread });
  }

  return { days: out, unplaced };
}
