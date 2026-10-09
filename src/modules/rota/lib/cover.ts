/** Cover: what each planned activity still needs (owner decisions, 6 October 2026).
 *
 *  A need is one activity at a site on a day ("Lifeguarding, Main pool, 07:00–21:30,
 *  3 places"). Each place is a lane; people are put on a place for part or all of
 *  the need's time, and whatever time a place has nobody on is a gap. The rota never
 *  blocks anything, so gaps are counted and shown, never refused. Pure, so the rules
 *  are tested on their own (cover.test.ts). */

export type Span = { start: number; end: number };
export type NeedLike = { id: string; startMinutes: number; endMinutes: number; places: number };
export type AssignmentLike = { id: string; needId: string; place: number; userId: string; startMinutes: number; endMinutes: number };
export type Gap = { needId: string; place: number; start: number; end: number };

/** `span` less every one of `taken`, as the stretches left, in time order. */
export function subtract(span: Span, taken: readonly Span[]): Span[] {
  const cuts = taken.filter((t) => t.start < span.end && span.start < t.end).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  let at = span.start;
  for (const t of cuts) {
    if (t.start > at) out.push({ start: at, end: Math.min(t.start, span.end) });
    at = Math.max(at, t.end);
    if (at >= span.end) break;
  }
  if (at < span.end) out.push({ start: at, end: span.end });
  return out;
}

/** Every stretch of a need's places with nobody on it, place by place. */
export function needGaps(need: NeedLike, assignments: readonly AssignmentLike[]): Gap[] {
  const mine = assignments.filter((a) => a.needId === need.id);
  const gaps: Gap[] = [];
  for (let place = 1; place <= need.places; place++) {
    const on = mine.filter((a) => a.place === place).map((a) => ({ start: a.startMinutes, end: a.endMinutes }));
    for (const g of subtract({ start: need.startMinutes, end: need.endMinutes }, on)) gaps.push({ needId: need.id, place, ...g });
  }
  return gaps;
}

/** Stretches that touch merge into one: back-to-back swim classes nobody teaches are one gap
 *  ("17:30–19:00, 3 classes"), not three. */
export function mergeTouching<T extends Span>(spans: readonly T[]): (T & { count: number })[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: (T & { count: number })[] = [];
  for (const s of sorted) {
    const last = out[out.length - 1];
    if (last && s.start <= last.end) { last.end = Math.max(last.end, s.end); last.count += 1; }
    else out.push({ ...s, count: 1 });
  }
  return out;
}

/** Lay items that may overlap into as few lanes as possible, earliest first, keeping each
 *  `key` (a teacher) on one lane where it fits: the timeline draws a lane per row. */
export function intoLanes<T extends Span & { key?: string | null }>(items: readonly T[]): T[][] {
  const lanes: T[][] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start || (a.key ?? "~").localeCompare(b.key ?? "~"))) {
    const free = (lane: T[]) => lane.every((x) => x.end <= item.start || item.end <= x.start);
    const same = item.key ? lanes.find((lane) => lane.some((x) => x.key === item.key) && free(lane)) : undefined;
    const lane = same ?? lanes.find(free);
    if (lane) lane.push(item);
    else lanes.push([item]);
  }
  return lanes;
}

/** Can a person go on this place for this time? It has to be inside the need, on a place it
 *  has, and not on top of someone already on that place. */
export function placeProblem(need: NeedLike, others: readonly AssignmentLike[], a: Omit<AssignmentLike, "id"> & { id?: string }): string | null {
  if (a.endMinutes <= a.startMinutes) return "The time has to end after it starts.";
  if (a.startMinutes < need.startMinutes || a.endMinutes > need.endMinutes) return "Keep the time inside the activity's own time.";
  if (a.place < 1 || a.place > need.places) return "That place is not on this activity.";
  const clash = others.find((o) => o.needId === need.id && o.place === a.place && o.id !== a.id && o.startMinutes < a.endMinutes && a.startMinutes < o.endMinutes);
  return clash ? "Someone is already on that place then. Choose another place or time." : null;
}
