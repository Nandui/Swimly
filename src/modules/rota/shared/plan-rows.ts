import { subtract, type Span } from "@/modules/rota/shared/cover";
import type { Block, DayNeed, Group, Person } from "@/modules/rota/shared/day";

/** The Plan's day, shift first (owner, 13 October 2026): "what needs people today" as one row per
 *  thing that needs people (an activity the department always needs, a booking, a run of swim
 *  classes, another module's session), each with how many people it has against how many it
 *  needs over the day; and each person's shift with the time nothing is given to yet ("No
 *  activity / booking"), ready to give to something. Pure (plan-rows.test.ts). */

export type NeedRowKind = "activity" | "booking" | "classes" | "booked";
/** A stretch of a row's day with the same cover: `have` people on it of `want`. `gap` is the
 *  first place in it nobody is on (or whose person is off), to fill. */
export type CoverSpan = Span & { have: number; want: number; gap: Block | null };
export type NeedRow = {
  key: string;
  kind: NeedRowKind;
  label: string;
  group: Group;
  /** The planned activity or booking it is, to change; none for classes and booked sessions. */
  need: DayNeed | null;
  blocks: Block[];
  start: number;
  end: number;
  cover: CoverSpan[];
  /** Places to fill in it, as the planner counts them. */
  gaps: number;
};

const needsCover = (b: Block) => b.kind === "gap" || (b.kind === "on" && b.warnings.includes("off"));

/** How many people a set of places has against how many it needs, stretch by stretch: each
 *  block is one place for its time, so overlapping places add up. Neighbouring stretches with
 *  the same count are one. */
export function coverOf(blocks: readonly Block[]): CoverSpan[] {
  const cuts = [...new Set(blocks.flatMap((b) => [b.start, b.end]))].sort((a, b) => a - b);
  const out: CoverSpan[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const here = blocks.filter((b) => b.start <= start && b.end >= end);
    if (!here.length) continue;
    const have = here.filter((b) => !needsCover(b)).length;
    const gap = here.find(needsCover) ?? null;
    const last = out[out.length - 1];
    if (last && last.end === start && last.have === have && last.want === here.length && (last.gap === gap || (!!last.gap && !!gap))) last.end = end;
    else out.push({ start, end, have, want: here.length, gap });
  }
  return out;
}

/** One row per thing that needs people, in the groups' order: each planned activity or booking
 *  on its own, a group's swim classes together, another module's sessions together. */
export function needRows(groups: readonly Group[]): NeedRow[] {
  const rows: NeedRow[] = [];
  const row = (key: string, kind: NeedRowKind, label: string, g: Group, need: DayNeed | null, blocks: Block[]) => {
    if (!blocks.length && !need) return;
    const sorted = [...blocks].sort((a, b) => a.start - b.start);
    const open = sorted.filter(needsCover);
    rows.push({ key, kind, label, group: g, need, blocks: sorted,
      start: need?.startMinutes ?? Math.min(...sorted.map((b) => b.start)), end: need?.endMinutes ?? Math.max(...sorted.map((b) => b.end)),
      cover: coverOf(sorted), gaps: g.href ? 0 : g.fromClasses ? g.gapCount : open.length });
  };
  for (const g of groups) {
    const all = g.lanes.flat();
    if (g.href) row(g.key, "booked", g.name, g, null, all);
    else if (g.fromClasses) row(g.key, "classes", g.name, g, null, all);
    else for (const n of g.needs) row(`${g.key}|${n.id}`, n.repeatTitle ? "booking" : "activity", n.repeatTitle ?? g.name, g, n, all.filter((b) => b.needId === n.id));
  }
  return rows;
}

/** What a person is on that day, from every department's groups, in time order. */
export function personBlocks(groups: readonly Group[], userId: string): { group: Group; block: Block }[] {
  return groups.flatMap((group) => group.lanes.flat().filter((b) => b.kind === "on" && b.userId === userId).map((block) => ({ group, block })))
    .sort((a, b) => a.block.start - b.block.start);
}

/** The time in someone's shifts nothing is given to and that is not a break: "No activity /
 *  booking", where every shift starts. Stretches under 5 minutes are left out. */
export function freeTime(person: Person, on: readonly Span[]): Span[] {
  return person.shift.parts.flatMap((part) => subtract(part, [...on, ...part.breaks])).filter((s) => s.end - s.start >= 5);
}

/** Paid minutes of each shift part: its length less the unpaid breaks it is owed, placed or not. */
export function partPaid(part: Person["shift"]["parts"][number]) {
  const unpaid = part.breaks.filter((b) => !b.paid).reduce((n, b) => n + b.end - b.start, 0) + part.unplaced.filter((b) => !b.paid).reduce((n, b) => n + b.minutes, 0);
  return { paid: part.end - part.start - unpaid, unpaid };
}
