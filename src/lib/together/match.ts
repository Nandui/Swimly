import type { DayOfWeek } from "@/generated/prisma/client";
import { DAY_META } from "@/lib/courses/constants";
import type { CourseRow } from "@/lib/courses/data/courses";

export type FamilyMember = {
  studentId: string;
  name: string;
  levelIds: string[];
  currentCourseIds: string[];
};

export type Placement = {
  studentId: string;
  name: string;
  course: CourseRow;
  alreadyIn: boolean;
};

export type CombinationPage = {
  combinations: Placement[][];
  /** Last assignment shown. Continuing starts after it, without a result cap. */
  next: string[] | null;
};

/** Enumerate assignments, not just one greedy answer. A cursor lets large
 * families explore every combination without materialising their Cartesian
 * product. Current places cost nothing; moving away does not promise that the
 * old seat is freed, because Together does not make a transfer. */
export function findCombinations(
  members: FamilyMember[],
  courses: CourseRow[],
  { after = null, limit = 5, differentTimes = false }: {
    after?: string[] | null;
    limit?: number;
    differentTimes?: boolean;
  } = {},
): CombinationPage {
  if (!members.length || members.some((member) => !member.levelIds.length)) {
    return { combinations: [], next: null };
  }
  const live = courses.filter((course) => !course.archivedAt);
  const remaining = new Map(live.map((course) => [course.id,
    course.capacity === null ? members.length : Math.max(0, course.capacity - course._count.enrolments),
  ]));
  const choices = members.map((member) => live
    .filter((course) => member.levelIds.includes(course.levelId) || member.currentCourseIds.includes(course.id))
    .map((course): Placement => ({ studentId: member.studentId, name: member.name, course,
      alreadyIn: member.currentCourseIds.includes(course.id) }))
    .filter((placement) => placement.alreadyIn || remaining.get(placement.course.id)! > 0)
    .sort((a, b) => Number(b.alreadyIn) - Number(a.alreadyIn) ||
      a.course.startMinutes - b.course.startMinutes || a.course.id.localeCompare(b.course.id)));
  if (choices.some((options) => !options.length)) return { combinations: [], next: null };

  const cursor = after?.map((id, index) => choices[index]?.findIndex((p) => p.course.id === id));
  const validCursor = cursor?.length === members.length && cursor.every((index) => index >= 0);
  const selected: Placement[] = [];
  const combinations: Placement[][] = [];
  const pageSize = Math.max(1, Math.trunc(limit));

  // Capacity matching prunes impossible branches, including overlapping levels,
  // before enumerating siblings ahead of a swimmer who cannot fit anywhere.
  function canFinish(from: number): boolean {
    const seats = live.flatMap((course) => Array.from(
      { length: Math.min(members.length, remaining.get(course.id) ?? 0) }, () => course.id));
    const owners = new Map<number, number>();
    function assign(member: number, visited: Set<number>): boolean {
      if (choices[member].some((p) => p.alreadyIn)) return true;
      for (let seat = 0; seat < seats.length; seat++) {
        if (visited.has(seat) || !choices[member].some((p) => p.course.id === seats[seat])) continue;
        visited.add(seat);
        const owner = owners.get(seat);
        if (owner === undefined || assign(owner, visited)) {
          owners.set(seat, member);
          return true;
        }
      }
      return false;
    }
    for (let member = from; member < members.length; member++) {
      if (!assign(member, new Set())) return false;
    }
    return true;
  }

  function visit(index: number, pastCursor: boolean) {
    if (combinations.length > pageSize) return;
    if (index === members.length) {
      if (pastCursor && (!differentTimes || new Set(selected.map((p) => p.course.startMinutes)).size > 1)) {
        combinations.push([...selected]);
      }
      return;
    }
    // Skip same-time permutations when looking for different-time options.
    if (differentTimes) {
      const times = new Set(selected.map((p) => p.course.startMinutes));
      for (const options of choices.slice(index)) for (const p of options) {
        if (p.alreadyIn || remaining.get(p.course.id)! > 0) times.add(p.course.startMinutes);
      }
      if (times.size < 2) return;
    }
    if (!canFinish(index)) return;
    const start = pastCursor ? 0 : cursor![index];
    for (let option = start; option < choices[index].length; option++) {
      const placement = choices[index][option];
      const free = remaining.get(placement.course.id)!;
      if (!placement.alreadyIn && free <= 0) continue;
      if (!placement.alreadyIn) remaining.set(placement.course.id, free - 1);
      selected.push(placement);
      visit(index + 1, pastCursor || option > cursor![index]);
      selected.pop();
      if (!placement.alreadyIn) remaining.set(placement.course.id, free);
      if (combinations.length > pageSize) break;
    }
  }
  visit(0, !validCursor);
  const hasMore = combinations.length > pageSize;
  if (hasMore) combinations.pop();
  return { combinations, next: hasMore ? combinations.at(-1)!.map((p) => p.course.id) : null };
}

export type SlotFit = { startMinutes: number; courses: CourseRow[] };
export type DayFit = { day: DayOfWeek; together: SlotFit[]; spread: CourseRow[] | null };
export type TogetherResult = { days: DayFit[]; unplaced: FamilyMember[] };

export function findTimesTogether(members: FamilyMember[], courses: CourseRow[]): TogetherResult {
  const unplaced = members.filter((member) => !member.levelIds.length);
  // Never label a partial family match as an option for everyone.
  if (!members.length || unplaced.length) return { days: [], unplaced };
  const live = courses.filter((course) => !course.archivedAt);
  const days = [...new Set(live.map((course) => course.dayOfWeek))]
    .sort((a, b) => DAY_META[a].index - DAY_META[b].index);
  const out: DayFit[] = [];
  for (const day of days) {
    const onDay = live.filter((course) => course.dayOfWeek === day);
    const together: SlotFit[] = [];
    for (const startMinutes of [...new Set(onDay.map((c) => c.startMinutes))].sort((a, b) => a - b)) {
      const atTime = onDay.filter((course) => course.startMinutes === startMinutes);
      if (findCombinations(members, atTime, { limit: 1 }).combinations.length) {
        together.push({ startMinutes, courses: atTime });
      }
    }
    const spread = findCombinations(members, onDay, { limit: 1, differentTimes: true }).combinations.length ? onDay : null;
    if (together.length || spread) out.push({ day, together, spread });
  }
  return { days: out, unplaced };
}
