import { mergeTouching, subtract, type Span } from "@/modules/rota/shared/cover";

/** Each area's minimum staff (owner request, 16 October 2026: "define a minimum of staffing for
 *  each area, and what type of staff that is, so when planning breaks and activities, if one area
 *  needs to be in use and creates a gap, that should be highlighted"). An area is in use while
 *  anything is on in it, and through the daily hours it is open when Admin sets them. Everyone on
 *  something in it counts there, unless they are off or on a break; a line asking for a
 *  qualification counts only people who hold it, in date. Pure (staffing.test.ts). */

/** "2 holding Pool Lifeguard", or `typeId` null for anyone. */
export type AreaMinimum = { count: number; typeId: string | null; typeName: string | null };
export type AreaRule = { name: string; openFrom: number | null; openUntil: number | null; minimums: AreaMinimum[] };
/** Someone in an area for a stretch. */
export type Presence = Span & { userId: string };
/** One stretch of an area's day in use: `have` of the `want` places filled, and the lines still
 *  short. */
export type StaffingSpan = Span & { have: number; want: number; short: AreaMinimum[]; userIds: string[] };
export type AreaStaffing = {
  /** The area's zone key on the day (`area:<name>`). */
  key: string;
  name: string;
  minimums: AreaMinimum[];
  /** The stretches it is in use, in time order. */
  spans: StaffingSpan[];
  /** Stretches short of its minimum. */
  shortCount: number;
};

/** Is someone holding this qualification (in date) on the day? */
export type Holds = (userId: string, typeId: string) => boolean;

/** How many staff a minimum asks for in all. */
export const wanted = (minimums: readonly AreaMinimum[]) => minimums.reduce((n, m) => n + m.count, 0);

/** "2 Pool Lifeguard, 1 anyone". */
export function minimumWords(minimums: readonly AreaMinimum[], short: (name: string) => string = (n) => n) {
  return minimums.map((m) => `${m.count} ${m.typeId ? short(m.typeName ?? "qualified") : "anyone"}`).join(", ");
}

/** The lines a set of people leaves short: each person fills one place, a qualified line only
 *  with someone who holds it. The most places that can be filled are (a matching), so a lifeguard
 *  is never spent on "anyone" while a lifeguard place is empty. */
export function shortOf(minimums: readonly AreaMinimum[], userIds: readonly string[], holds: Holds): { have: number; short: AreaMinimum[] } {
  const places = minimums.flatMap((m, line) => Array.from({ length: Math.max(0, m.count) }, () => line));
  const fits = (userId: string, place: number) => { const typeId = minimums[places[place]].typeId; return !typeId || holds(userId, typeId); };
  const taken = new Array<number>(places.length).fill(-1);
  const tryPut = (person: number, seen: boolean[]): boolean => {
    for (let place = 0; place < places.length; place++) {
      if (seen[place] || !fits(userIds[person], place)) continue;
      seen[place] = true;
      if (taken[place] < 0 || tryPut(taken[place], seen)) { taken[place] = person; return true; }
    }
    return false;
  };
  let have = 0;
  for (let person = 0; person < userIds.length; person++) if (tryPut(person, new Array<boolean>(places.length).fill(false))) have += 1;
  const short = minimums.map((m, line) => ({ ...m, count: places.filter((l, place) => l === line && taken[place] < 0).length })).filter((m) => m.count > 0);
  return { have, short };
}

/** When an area is in use that day: whatever is on in it, and its opening hours. */
export function inUse(rule: Pick<AreaRule, "openFrom" | "openUntil">, items: readonly Span[]): Span[] {
  const open = rule.openFrom !== null && rule.openUntil !== null && rule.openUntil > rule.openFrom ? [{ start: rule.openFrom, end: rule.openUntil }] : [];
  return mergeTouching([...items, ...open]).map(({ start, end }) => ({ start, end }));
}

const shortKey = (short: readonly AreaMinimum[]) => short.map((m) => `${m.count}×${m.typeId ?? "*"}`).join("|");

/** An area's day against its minimum, stretch by stretch: `userIds` is everyone in it at some
 *  point of the stretch. */
export function staffingSpans(minimums: readonly AreaMinimum[], use: readonly Span[], present: readonly Presence[], holds: Holds): StaffingSpan[] {
  const want = wanted(minimums);
  const out: StaffingSpan[] = [];
  for (const window of use) {
    const cuts = [...new Set([window.start, window.end, ...present.flatMap((p) => [p.start, p.end]).filter((t) => t > window.start && t < window.end)])].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i], end = cuts[i + 1];
      const userIds = [...new Set(present.filter((p) => p.start <= start && p.end >= end).map((p) => p.userId))].sort();
      const { have, short } = shortOf(minimums, userIds, holds);
      // Neighbouring stretches as short in the same way are one, whoever is on: a hand-over
      // between two lifeguards does not split the pool's day.
      const last = out[out.length - 1];
      const same = last && last.end === start && last.have === have && shortKey(last.short) === shortKey(short);
      if (same) { last.end = end; last.userIds = [...new Set([...last.userIds, ...userIds])].sort(); }
      else out.push({ start, end, have, want, short, userIds });
    }
  }
  return out;
}

/** How short an area is over a stretch: minutes times the square of the places short, so two
 *  breaks at once in a short area weigh more than the same two apart. Compared with and without
 *  someone, it says how much worse their leaving then would make it. */
export function shortWeight(minimums: readonly AreaMinimum[], use: readonly Span[], present: readonly Presence[], holds: Holds, within: Span): number {
  const clipped = use.flatMap((u) => { const s = Math.max(u.start, within.start), e = Math.min(u.end, within.end); return e > s ? [{ start: s, end: e }] : []; });
  return staffingSpans(minimums, clipped, present, holds).reduce((n, s) => n + (s.want - s.have) ** 2 * (s.end - s.start), 0);
}

/** Someone's time in an area less a stretch (their break). */
export function without(present: readonly Presence[], userId: string, span: Span): Presence[] {
  return present.flatMap((p) => (p.userId !== userId ? [p] : subtract(p, [span]).map((s) => ({ ...s, userId }))));
}
