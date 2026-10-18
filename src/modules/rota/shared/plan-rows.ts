import { subtract, type Span } from "@/modules/rota/shared/cover";
import { isAreaNeed, type Block, type DayNeed, type Group, type Person } from "@/modules/rota/shared/day";

/** The Plan's day, shift first (owner, 13 October 2026): "what needs people today" as one row per
 *  thing that needs people (an area's own need, an activity the department always needs, a booking, a run of swim
 *  classes, another module's session), each with how many people it has against how many it
 *  needs over the day; and each person's shift with the time nothing is given to yet ("No
 *  activity / booking"), ready to give to something. Pure (plan-rows.test.ts). */

type NeedRowKind = "area" | "activity" | "booking" | "classes" | "booked";
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
 *  the same count and the same people are one, so a hand-over (someone covering 10:00 to 11:00
 *  of an activity; owner request, 16 October 2026) shows as its own stretch with its own name. */
export function coverOf(blocks: readonly Block[]): CoverSpan[] {
  const cuts = [...new Set(blocks.flatMap((b) => [b.start, b.end]))].sort((a, b) => a - b);
  const out: CoverSpan[] = [];
  let lastWho = "";
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i], end = cuts[i + 1];
    const here = blocks.filter((b) => b.start <= start && b.end >= end);
    if (!here.length) continue;
    const have = here.filter((b) => !needsCover(b)).length;
    const gap = here.find(needsCover) ?? null;
    const who = here.filter((b) => !needsCover(b)).map((b) => b.userId ?? "").sort().join("|");
    const last = out[out.length - 1];
    if (last && last.end === start && last.have === have && last.want === here.length && lastWho === who && (last.gap === gap || (!!last.gap && !!gap))) last.end = end;
    else out.push({ start, end, have, want: here.length, gap });
    lastWho = who;
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
    else for (const n of g.needs) row(`${g.key}|${n.id}`, isAreaNeed(n.id) ? "area" : n.repeatTitle ? "booking" : "activity", n.repeatTitle ?? g.name, g, n, all.filter((b) => b.needId === n.id));
  }
  return rows;
}

/** What needs people, area by area (owner, 16 October 2026: "areas with bookings and activities"):
 *  each area once, in the site's order of areas (`order`, Admin, Areas), then any other place by
 *  name, then things with no area. In an area its own need comes first, then what is in it by
 *  start time. */
export type AreaRows = { place: string; rows: NeedRow[]; gaps: number };
const KIND_ORDER: Record<NeedRowKind, number> = { area: 0, activity: 1, booking: 1, classes: 1, booked: 1 };
export function byArea(rows: readonly NeedRow[], order: readonly string[]): AreaRows[] {
  const places = new Map<string, { place: string; rows: NeedRow[] }>();
  for (const r of rows) {
    const place = r.group.place.trim();
    const key = place.toLowerCase();
    const at = places.get(key) ?? { place, rows: [] };
    at.rows.push(r);
    places.set(key, at);
  }
  const rank = (place: string) => {
    const i = order.findIndex((o) => o.trim().toLowerCase() === place.toLowerCase());
    return place ? (i < 0 ? order.length : i) : order.length + 1;
  };
  return [...places.values()]
    .map(({ place, rows: list }) => ({ place, rows: [...list].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.start - b.start), gaps: list.reduce((n, r) => n + r.gaps, 0) }))
    .sort((a, b) => rank(a.place) - rank(b.place) || a.place.localeCompare(b.place));
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
