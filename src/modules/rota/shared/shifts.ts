import { breakEntitlement, type YoungBand } from "@/modules/rota/shared/constants";
import { mergeTouching, subtract, type Span } from "@/modules/rota/shared/cover";

/** A person's shift. A planner can put someone on a shift first and fill it with activities
 *  (owner decision, 8 October 2026); otherwise it comes from the activities they are on (6
 *  October): from their first start to their last finish, a stretch of an hour or more with
 *  nothing on splitting the day in two. Work outside a planned shift makes a worked-out one.
 *  Breaks follow the house rule (`breakEntitlement`, under-18s included). The manager places
 *  them (handbook: "all breaks will be allocated by the Manager on shift"); the ones not placed
 *  yet are suggested in time they have nothing on, so a suggestion never takes someone off an
 *  activity. A placed break may, and the plan says so. Pure (cover.test.ts, shifts.test.ts). */

export type WorkItem = Span & { label: string };
/** `pinned`: placed by the manager; otherwise a suggestion. */
export type PlacedBreak = Span & { paid: boolean; pinned: boolean };
/** A break the manager placed (`RotaBreak`). */
export type PinnedBreak = { start: number; minutes: number; paid: boolean };
export type ShiftPart = Span & {
  /** Put on the plan as a shift, rather than worked out from their activities. */
  planned: boolean;
  work: WorkItem[];
  breaks: PlacedBreak[];
  /** Breaks the person is owed that found no free time. */
  unplaced: { minutes: number; paid: boolean }[];
};
export type DayShift = Span & { parts: ShiftPart[]; paidMinutes: number };

/** Nothing on for this long between activities means two shifts, not one long one. */
const SPLIT_AFTER = 60;

/** Where in a shift each break aims for: one in the middle; two at about a third and
 *  three fifths; three at a quarter, half and three quarters (the old planner's rule). */
const AIM = [[0.5], [0.35, 0.6], [0.25, 0.5, 0.75]] as const;

export function dayShift(work: readonly WorkItem[], young: YoungBand | null = null, options: { planned?: readonly Span[]; pinned?: readonly PinnedBreak[] } = {}): DayShift | null {
  const planned = mergeTouching([...(options.planned ?? [])].map((p) => ({ start: p.start, end: p.end })));
  if (!work.length && !planned.length) return null;
  // Work outside every planned shift makes shifts of its own, as before.
  const outside = work.flatMap((w) => subtract({ start: w.start, end: w.end }, planned));
  const merged = mergeTouching(outside);
  const spans: (Span & { planned: boolean })[] = [];
  for (const m of merged) {
    const last = spans[spans.length - 1];
    if (last && m.start - last.end < SPLIT_AFTER) last.end = Math.max(last.end, m.end);
    else spans.push({ start: m.start, end: m.end, planned: false });
  }
  const all = [...planned.map((p) => ({ start: p.start, end: p.end, planned: true })), ...spans].sort((a, b) => a.start - b.start);
  const pins = [...(options.pinned ?? [])];
  const parts = all.map((span) => placeBreaks(span, work.filter((w) => w.start < span.end && span.start < w.end), young, pins));
  const unpaid = parts.reduce((sum, p) => sum + breakEntitlement(p.end - p.start, young).filter((b) => !b.paid).reduce((s, b) => s + b.minutes, 0), 0);
  const length = parts.reduce((sum, p) => sum + p.end - p.start, 0);
  return { start: parts[0].start, end: parts[parts.length - 1].end, parts, paidMinutes: length - unpaid };
}

/** Each break owed: the manager's, when one of that length and pay starts in this part (each used
 *  once), else the suggestion nearest its aim, in free time and clear of the others. */
function placeBreaks(span: Span & { planned: boolean }, work: readonly WorkItem[], young: YoungBand | null, pins: PinnedBreak[]): ShiftPart {
  const owed = breakEntitlement(span.end - span.start, young);
  const free = subtract(span, work);
  const breaks: PlacedBreak[] = [];
  const unplaced: ShiftPart["unplaced"] = [];
  const length = span.end - span.start;
  const left: { minutes: number; paid: boolean; i: number }[] = [];
  owed.forEach((b, i) => {
    const at = pins.findIndex((p) => p.minutes === b.minutes && p.paid === b.paid && p.start >= span.start && p.start + p.minutes <= span.end);
    if (at < 0) { left.push({ ...b, i }); return; }
    const [pin] = pins.splice(at, 1);
    breaks.push({ start: pin.start, end: pin.start + pin.minutes, paid: pin.paid, pinned: true });
  });
  left.forEach((b) => {
    const i = b.i;
    const target = span.start + length * (AIM[Math.min(owed.length, 3) - 1]?.[i] ?? 0.5) - b.minutes / 2;
    let best: number | null = null;
    for (const f of free) {
      // Quarter hours inside this free stretch, clear of the breaks already placed.
      for (let at = Math.ceil(f.start / 15) * 15; at + b.minutes <= f.end; at += 15) {
        if (breaks.some((x) => x.start < at + b.minutes && at < x.end)) continue;
        if (best === null || Math.abs(at - target) < Math.abs(best - target)) best = at;
      }
      // A free stretch off the quarter hour still fits exactly.
      if (f.end - f.start >= b.minutes && !breaks.some((x) => x.start < f.start + b.minutes && f.start < x.end)
        && (best === null || Math.abs(f.start - target) < Math.abs(best - target))) best = f.start;
    }
    if (best === null) unplaced.push({ minutes: b.minutes, paid: b.paid });
    else breaks.push({ start: best, end: best + b.minutes, paid: b.paid, pinned: false });
  });
  return { start: span.start, end: span.end, planned: span.planned, work: [...work].sort((a, b) => a.start - b.start), breaks: breaks.sort((a, b) => a.start - b.start), unplaced };
}

/** "7h 30m", "45m", "8h". */
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
