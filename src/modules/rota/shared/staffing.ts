import { subtract, type Span } from "@/modules/rota/shared/cover";

/** How short an area is of the staff it needs while it is open (owner requests, 16 October 2026:
 *  "each area has their needs... during that time it will need a specific amount of staff with
 *  specific qualifications"), for placing breaks so it is never left shorter than it has to be.
 *  Only the people on the area's own need count, a qualified place only someone holding it in
 *  date. Pure (staffing.test.ts). */

/** "2 holding Pool Lifeguard", or `typeId` null for anyone. A line tied to an activity (owner,
 *  21 October 2026: "at least 1 on Serving customers") names it, and the times it applies when
 *  not whenever the area is open. */
export type AreaMinimum = { count: number; typeId: string | null; typeName: string | null;
  activityTypeId?: string | null; activityName?: string | null; from?: number | null; until?: number | null };
/** Someone in an area for a stretch. */
export type Presence = Span & { userId: string };
/** One stretch of an area's day in use: `have` of the `want` places filled, and the lines still
 *  short. */
export type StaffingSpan = Span & { have: number; want: number; short: AreaMinimum[]; userIds: string[] };
/** Is someone holding this qualification (in date) on the day? */
export type Holds = (userId: string, typeId: string) => boolean;

/** How many staff a minimum asks for in all. */
export const wanted = (minimums: readonly AreaMinimum[]) => minimums.reduce((n, m) => n + m.count, 0);

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
