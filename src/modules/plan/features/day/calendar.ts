import type { Span } from "@/modules/plan/shared/model";

/** The Day as a calendar (owner's choice, 16 November 2026: "Calendar"): time runs down the page
 *  and each column is a place someone must be. Pure, so it is tested without a screen
 *  (calendar.test.ts); the screen decides every word. */

/** One block in a column. `pick` says what it opens (a gap to fill, someone's duty, a class, the
 *  people free then); two blocks can open the same thing (a gap two short), so `key` is its own. */
export type CalendarEntry = Span & {
  key: string;
  pick: string;
  kind: "on" | "gap" | "break" | "free";
  /** Who is there: one person on a duty or break, everyone free in a free stretch, nobody in a gap. */
  userIds: string[];
  /** What is on there (the session or class), where the block belongs to one. */
  what: string | null;
};
export type CalendarColumn = { key: string; label: string; entries: CalendarEntry[] };
/** An area with something on, then the duties that belong to nothing on, then the people on
 *  nothing. `short` counts the things on there that still need someone. */
export type CalendarGroup = { key: string; label: string; short: number; columns: CalendarColumn[] };

export const OTHER_GROUP = "other";
export const SPARE_GROUP = "spare";

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

const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;

/** As few columns as hold the blocks without one over another: each on the first column free for it. */
function pack(group: string, label: string, entries: CalendarEntry[]): CalendarColumn[] {
  const columns: CalendarColumn[] = [];
  for (const entry of [...entries].sort((a, b) => a.start - b.start || a.end - b.end)) {
    let column = columns.find((c) => !c.entries.some((e) => overlaps(e, entry)));
    if (!column) columns.push(column = { key: `${group}|${label}|${columns.length}`, label, entries: [] });
    column.entries.push(entry);
  }
  return columns;
}

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

/** The day's calendar.
 *  - `needs` are everything on that needs people, the whole site's, with who fills each and where
 *    it is short. Each area is a group; within it each duty has as many columns as it has people
 *    on at once, and classes have theirs. A gap two short is two blocks.
 *  - `shifts` are every shift (to say whose block a fill is); `shown` the ones whose duties on
 *    nothing, breaks and free time are listed (one department's, or all). */
export function calendarOf(input: {
  areas: readonly { id: string; name: string; parentId: string | null }[];
  needs: readonly NeedIn[];
  shifts: readonly ShiftIn[];
  shown: readonly ShiftIn[];
  dutyName: (dutyId: string) => string;
  isBreak: (dutyId: string) => boolean;
  /** The column names that are not a duty's. */
  words: { classes: string; otherDuties: string; notOn: string; onBreak: string; free: string };
}): CalendarGroup[] {
  const { areas, needs, shifts, shown, words } = input;
  const byId = new Map(areas.map((a) => [a.id, a]));
  const owner = new Map(shifts.flatMap((s) => s.blocks.map((b) => [b.id, s] as const)));
  const wholeOf = (id: string | null) => { const a = id ? byId.get(id) : undefined; return a?.parentId ? byId.get(a.parentId) ?? a : a; };

  // Where each need sits: its whole area, else the place it names.
  const placed = needs.map((need) => {
    const whole = wholeOf(need.placeAreaId);
    return { need, group: whole ? whole.id : `where:${need.where}`, label: whole ? whole.name : need.where };
  });
  const loose = [...new Set(placed.filter((p) => p.group.startsWith("where:")).map((p) => p.label))]
    .sort((a, b) => Number(a === "No area") - Number(b === "No area") || a.localeCompare(b));
  const order = [...areas.filter((a) => !a.parentId).map((a) => ({ key: a.id, label: a.name })), ...loose.map((label) => ({ key: `where:${label}`, label }))];

  const groups: CalendarGroup[] = [];
  for (const g of order) {
    const here = placed.filter((p) => p.group === g.key).map((p) => p.need);
    if (!here.length) continue;
    const lists = new Map<string, { classes: boolean; first: number; entries: CalendarEntry[] }>();
    for (const need of here) {
      const label = need.kind === "class" ? words.classes : input.dutyName(need.dutyId);
      const list = lists.get(label) ?? { classes: need.kind === "class", first: need.start, entries: [] };
      list.first = Math.min(list.first, ...need.fills.map((f) => f.start), ...need.gaps.map((x) => x.start));
      need.fills.forEach((f, i) => {
        const shift = f.blockId ? owner.get(f.blockId) : undefined;
        const userId = f.userId ?? shift?.userId;
        list.entries.push({ key: `fill|${need.key}|${f.blockId ?? i}`, start: f.start, end: f.end, kind: "on", userIds: userId ? [userId] : [], what: need.label,
          pick: shift && f.blockId ? `block|${shift.id}|${f.blockId}` : `item|${need.sessionId ? `s:${need.sessionId}` : need.key}` });
      });
      need.gaps.forEach((gap, i) => {
        for (let n = 0; n < gap.short; n++) list.entries.push({ key: `gap|${need.key}|${i}|${n}`, start: gap.start, end: gap.end, kind: "gap", userIds: [], what: need.label, pick: `gap|${need.key}|${i}` });
      });
      lists.set(label, list);
    }
    const columns = [...lists.entries()].sort(([, a], [, b]) => Number(a.classes) - Number(b.classes) || a.first - b.first)
      .flatMap(([label, list]) => pack(g.key, label, list.entries));
    const short = new Set(here.filter((n) => n.gaps.length).map((n) => n.sessionId ?? n.key)).size;
    if (columns.length) groups.push({ key: g.key, label: g.label, short, columns });
  }

  // Duties that belong to nothing on (a duty given by itself), by duty.
  const other = new Map<string, CalendarEntry[]>();
  for (const s of shown) for (const b of s.blocks) {
    if (b.sessionId || input.isBreak(b.dutyId)) continue;
    const label = input.dutyName(b.dutyId);
    other.set(label, [...(other.get(label) ?? []), { key: `duty|${b.id}`, start: b.start, end: b.end, kind: "on", userIds: [s.userId], what: null, pick: `block|${s.id}|${b.id}` }]);
  }
  if (other.size) groups.push({ key: OTHER_GROUP, label: words.otherDuties, short: 0, columns: [...other.entries()].flatMap(([label, entries]) => pack(OTHER_GROUP, label, entries)) });

  // People on nothing: breaks each in a column, and free time as one column that names everyone
  // free in each stretch (it can be many people, so they share the block).
  const breaks = shown.flatMap((s) => s.blocks.filter((b) => input.isBreak(b.dutyId))
    .map((b): CalendarEntry => ({ key: `break|${b.id}`, start: b.start, end: b.end, kind: "break", userIds: [s.userId], what: null, pick: `block|${s.id}|${b.id}` })));
  const free = shown.flatMap((s) => freeTimeOf(s).map((f) => ({ ...f, userId: s.userId })));
  const points = [...new Set(free.flatMap((f) => [f.start, f.end]))].sort((a, b) => a - b);
  const stretches: CalendarEntry[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [start, end] = [points[i], points[i + 1]];
    const userIds = [...new Set(free.filter((f) => f.start <= start && f.end >= end).map((f) => f.userId))];
    if (!userIds.length) continue;
    const last = stretches[stretches.length - 1];
    if (last && last.end === start && last.userIds.join("|") === userIds.join("|")) last.end = end;
    else stretches.push({ key: `free|${start}`, start, end, kind: "free", userIds, what: null, pick: "" });
  }
  for (const s of stretches) { s.key = `free|${s.start}|${s.end}`; s.pick = `spare|${s.start}|${s.end}`; }
  const spare = [...pack(SPARE_GROUP, words.onBreak, breaks), ...(stretches.length ? [{ key: `${SPARE_GROUP}|free`, label: words.free, entries: stretches }] : [])];
  if (spare.length) groups.push({ key: SPARE_GROUP, label: words.notOn, short: 0, columns: spare });
  return groups;
}
