import { occurrencesOn, shiftIso, weekdayOfIso, type SessionDef } from "@/modules/plan/shared/model";

/** Work belongs to an activity (D33), but blocks made before that rule can still be on a kind of
 *  work by itself. This says, purely, where each of them would go:
 *  - onto an activity already at its site that runs that day, needs that kind of work, and covers
 *    the block's times (the shortest such activity, so a booking wins over the pool being open);
 *  - else onto a new activity made for it and its like: the same site, kind of work and times,
 *    running on the weekdays they fall on, from the first of those days to the last, needing as
 *    many people as the most on any one day.
 *  Breaks are never passed in: a break stands by itself. Nothing here writes; move-lone-blocks.ts
 *  does, and only when asked. */

export type LoneBlock = { id: string; siteId: string; date: string; dutyId: string; start: number; end: number };

export type Join = { kind: "join"; siteId: string; sessionId: string; title: string; dutyId: string; blockIds: string[]; dates: string[] };
export type Make = {
  kind: "make"; siteId: string; dutyId: string; start: number; end: number;
  weekdays: number[]; firstDay: string; lastDay: string; skipDays: string[]; count: number; blockIds: string[]; dates: string[];
};
export type Move = Join | Make;

/** An activity lists at most this many days it doesn't run (rules.ts, `sessionSchema`). */
export const MAX_SKIP_DAYS = 60;

const uniqueSorted = <T,>(items: T[]) => [...new Set(items)].sort();

/** The days from `first` to `last` that fall on `weekdays` and are not in `on`. */
function gapsBetween(first: string, last: string, weekdays: readonly number[], on: ReadonlySet<string>): string[] {
  const out: string[] = [];
  for (let d = first; d <= last; d = shiftIso(d, 1)) if (weekdays.includes(weekdayOfIso(d)) && !on.has(d)) out.push(d);
  return out;
}

export function planLoneBlocks(blocks: readonly LoneBlock[], sessions: readonly (SessionDef & { siteId: string })[]): Move[] {
  const joins = new Map<string, Join>();
  const rest: LoneBlock[] = [];
  for (const b of blocks) {
    const home = sessions.filter((s) => s.siteId === b.siteId && s.needs.some((n) => n.dutyId === b.dutyId))
      .flatMap((s) => occurrencesOn([s], b.date).map((o) => ({ s, o })))
      .filter(({ o }) => o.start <= b.start && o.end >= b.end)
      .sort((x, y) => (x.o.end - x.o.start) - (y.o.end - y.o.start) || x.s.title.localeCompare(y.s.title) || x.s.id.localeCompare(y.s.id))[0];
    if (!home) { rest.push(b); continue; }
    const key = `${home.s.id}|${b.dutyId}`;
    const join = joins.get(key) ?? { kind: "join" as const, siteId: b.siteId, sessionId: home.s.id, title: home.s.title, dutyId: b.dutyId, blockIds: [], dates: [] };
    join.blockIds.push(b.id);
    join.dates.push(b.date);
    joins.set(key, join);
  }

  const groups = new Map<string, LoneBlock[]>();
  for (const b of rest) {
    const key = `${b.siteId}|${b.dutyId}|${b.start}|${b.end}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  const makes: Make[] = [];
  for (const group of groups.values()) {
    const { siteId, dutyId, start, end } = group[0];
    const make = (members: LoneBlock[]): Make => {
      const dates = uniqueSorted(members.map((b) => b.date));
      const weekdays = uniqueSorted(dates.map(weekdayOfIso));
      return {
        kind: "make", siteId, dutyId, start, end, weekdays, firstDay: dates[0], lastDay: dates[dates.length - 1],
        skipDays: gapsBetween(dates[0], dates[dates.length - 1], weekdays, new Set(dates)),
        count: Math.max(...dates.map((d) => members.filter((b) => b.date === d).length)),
        blockIds: members.map((b) => b.id), dates,
      };
    };
    const one = make(group);
    // Too scattered to be one activity with days off: a one-day activity for each day instead.
    if (one.skipDays.length <= MAX_SKIP_DAYS) makes.push(one);
    else for (const date of one.dates) makes.push(make(group.filter((b) => b.date === date)));
  }
  const byPlace = (a: Move, b: Move) => a.siteId.localeCompare(b.siteId) || a.dates[0].localeCompare(b.dates[0]);
  return [...[...joins.values()].map((j) => ({ ...j, dates: uniqueSorted(j.dates) })).sort(byPlace), ...makes.sort((a, b) => byPlace(a, b) || a.start - b.start)];
}
