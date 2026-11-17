import type { Span } from "@/modules/plan/shared/model";

/** The Day, area by area (owner, 16 November 2026: "person by person per area", one timeline and
 *  not two to match up): each area holds what's on there, what still needs someone, and a line for
 *  every person who works there with only their time in that area, so someone on the pool in the
 *  morning and the desk after lunch has a line under each. What belongs to no area (a duty given by
 *  itself, breaks, free time) comes last, a line per person. Pure, so it is tested without a screen
 *  (by-area.test.ts); the screen decides every word. */

/** A thing on in an area: a session with all its duties, or a class. */
export type AreaItem = Span & { key: string; label: string; short: number; userIds: string[] };
/** A stretch of a need nobody fills. */
export type AreaGap = Span & { needKey: string; index: number; dutyId: string; label: string; short: number };
/** One stretch of someone's time: on a duty (theirs to open as a block), teaching a class (opens the class). */
export type AreaStint = Span & { key: string; dutyId: string; what: string; shiftId: string | null; blockId: string | null; itemKey: string };
export type AreaGroup = { key: string; label: string; short: number; items: AreaItem[]; gaps: AreaGap[]; people: { userId: string; stints: AreaStint[] }[] };
/** What a person does outside every area: a duty given by itself, a break, or nothing yet. */
export type RestStint = Span & { key: string; kind: "duty" | "break" | "free"; dutyId: string | null; blockId: string | null };
export type RestLine = { shiftId: string; userId: string; stints: RestStint[] };

type NeedIn = Span & {
  key: string;
  kind: "session" | "class";
  sessionId: string | null;
  label: string;
  where: string;
  placeAreaId: string | null;
  dutyId: string;
  fills: readonly (Span & { userId?: string; blockId?: string })[];
  gaps: readonly (Span & { short: number })[];
};
type ShiftIn = Span & { id: string; userId: string; blocks: readonly (Span & { id: string; dutyId: string; sessionId: string | null })[]; classes: readonly Span[] };

/** The stretches of a shift with no duty, break or class in them. */
export function freeTimeOf(shift: Span & { blocks: readonly Span[]; classes: readonly Span[] }): Span[] {
  const busy = [...shift.blocks, ...shift.classes].sort((a, b) => a.start - b.start);
  const free: Span[] = [];
  let at = shift.start;
  for (const b of busy) {
    if (b.start > at) free.push({ start: at, end: Math.min(b.start, shift.end) });
    at = Math.max(at, b.end);
  }
  if (at < shift.end) free.push({ start: at, end: shift.end });
  return free.filter((f) => f.end > f.start);
}

const itemKeyOf = (need: { sessionId: string | null; key: string }) => (need.sessionId ? `s:${need.sessionId}` : need.key);

/** The day by area.
 *  - `needs` are everything on that needs people, the whole site's, with who fills each and where
 *    it is short. An area's parts sit in the area; a place that is no area has a group of its own,
 *    "No area" last.
 *  - `shifts` are every shift (to say whose block a fill is); `shown` the ones whose time outside
 *    every area is listed (one department's, or all). */
export function dayByArea(input: {
  areas: readonly { id: string; name: string; parentId: string | null }[];
  needs: readonly NeedIn[];
  shifts: readonly ShiftIn[];
  shown: readonly ShiftIn[];
  isBreak: (dutyId: string) => boolean;
}): { groups: AreaGroup[]; rest: RestLine[] } {
  const { areas, needs, shifts, shown } = input;
  const byId = new Map(areas.map((a) => [a.id, a]));
  const owner = new Map(shifts.flatMap((s) => s.blocks.map((b) => [b.id, s] as const)));
  const wholeOf = (id: string | null) => { const a = id ? byId.get(id) : undefined; return a?.parentId ? byId.get(a.parentId) ?? a : a; };
  const placed = needs.map((need) => {
    const whole = wholeOf(need.placeAreaId);
    return { need, group: whole ? whole.id : `where:${need.where}`, label: whole ? whole.name : need.where };
  });
  const loose = [...new Set(placed.filter((p) => p.group.startsWith("where:")).map((p) => p.label))]
    .sort((a, b) => Number(a === "No area") - Number(b === "No area") || a.localeCompare(b));
  const order = [...areas.filter((a) => !a.parentId).map((a) => ({ key: a.id, label: a.name })), ...loose.map((label) => ({ key: `where:${label}`, label }))];

  const groups: AreaGroup[] = [];
  for (const g of order) {
    const here = placed.filter((p) => p.group === g.key).map((p) => p.need);
    if (!here.length) continue;
    const items = new Map<string, AreaItem>();
    const people = new Map<string, AreaStint[]>();
    const gaps: AreaGap[] = [];
    for (const need of here) {
      const key = itemKeyOf(need);
      const item = items.get(key) ?? { key, label: need.label, start: need.start, end: need.end, short: 0, userIds: [] };
      item.short += Math.max(0, ...need.gaps.map((x) => x.short));
      need.fills.forEach((f, i) => {
        const shift = f.blockId ? owner.get(f.blockId) : undefined;
        const userId = f.userId ?? shift?.userId;
        if (!userId) return;
        if (!item.userIds.includes(userId)) item.userIds.push(userId);
        people.set(userId, [...(people.get(userId) ?? []), { key: `${need.key}|${f.blockId ?? i}`, start: f.start, end: f.end, dutyId: need.dutyId, what: need.label,
          shiftId: shift?.id ?? null, blockId: shift && f.blockId ? f.blockId : null, itemKey: key }]);
      });
      need.gaps.forEach((gap, index) => gaps.push({ needKey: need.key, index, start: gap.start, end: gap.end, dutyId: need.dutyId, label: need.label, short: gap.short }));
      items.set(key, item);
    }
    const byTime = (a: Span, b: Span) => a.start - b.start || a.end - b.end;
    groups.push({
      key: g.key, label: g.label, short: [...items.values()].filter((i) => i.short > 0).length,
      items: [...items.values()].sort(byTime), gaps: gaps.sort(byTime),
      people: [...people.entries()].map(([userId, stints]) => ({ userId, stints: stints.sort(byTime) })).sort((a, b) => byTime(a.stints[0], b.stints[0])),
    });
  }

  // Outside every area: a duty that belongs to nothing on, breaks, and the time nothing fills.
  // Someone whose whole shift is spent in areas has no line here.
  const rest = shown.map((s): RestLine => ({ shiftId: s.id, userId: s.userId, stints: [
    ...s.blocks.filter((b) => !b.sessionId).map((b): RestStint => ({ key: `b|${b.id}`, start: b.start, end: b.end, kind: input.isBreak(b.dutyId) ? "break" : "duty", dutyId: b.dutyId, blockId: b.id })),
    ...freeTimeOf(s).map((f): RestStint => ({ key: `f|${s.id}|${f.start}`, start: f.start, end: f.end, kind: "free", dutyId: null, blockId: null })),
  ].sort((a, b) => a.start - b.start || a.end - b.end) })).filter((line) => line.stints.length > 0);
  return { groups, rest };
}
