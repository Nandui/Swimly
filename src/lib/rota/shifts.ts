import { breakEntitlement, type YoungBand } from "@/lib/rota/constants";
import { mergeTouching, subtract, type Span } from "@/lib/rota/cover";

/** A person's shift is not planned: it comes from the activities they are on (owner decision,
 *  6 October 2026). It runs from their first start to their last finish; a stretch of an hour
 *  or more with nothing on splits the day into two shifts. Breaks follow the house rule
 *  (`breakEntitlement`, under-18s included) and go into time they have nothing on, so a break
 *  never takes someone off an activity without the planner seeing it: when there is no room,
 *  the shift says so and the planner leaves a gap to cover. Pure (shifts.test.ts). */

export type WorkItem = Span & { label: string };
export type PlacedBreak = Span & { paid: boolean };
export type ShiftPart = Span & {
  work: WorkItem[];
  breaks: PlacedBreak[];
  /** Breaks the person is owed that found no free time. */
  unplaced: { minutes: number; paid: boolean }[];
};
export type DayShift = Span & { parts: ShiftPart[]; paidMinutes: number };

/** Nothing on for this long between activities means two shifts, not one long one. */
export const SPLIT_AFTER = 60;

/** Where in a shift each break aims for: one in the middle; two at about a third and
 *  three fifths; three at a quarter, half and three quarters (the old planner's rule). */
const AIM = [[0.5], [0.35, 0.6], [0.25, 0.5, 0.75]] as const;

export function dayShift(work: readonly WorkItem[], young: YoungBand | null = null): DayShift | null {
  if (!work.length) return null;
  const merged = mergeTouching(work.map((w) => ({ start: w.start, end: w.end })));
  const spans: Span[] = [];
  for (const m of merged) {
    const last = spans[spans.length - 1];
    if (last && m.start - last.end < SPLIT_AFTER) last.end = Math.max(last.end, m.end);
    else spans.push({ start: m.start, end: m.end });
  }
  const parts = spans.map((span) => placeBreaks(span, work.filter((w) => w.start < span.end && span.start < w.end), young));
  const unpaid = parts.reduce((sum, p) => sum + breakEntitlement(p.end - p.start, young).filter((b) => !b.paid).reduce((s, b) => s + b.minutes, 0), 0);
  const length = parts.reduce((sum, p) => sum + p.end - p.start, 0);
  return { start: parts[0].start, end: parts[parts.length - 1].end, parts, paidMinutes: length - unpaid };
}

function placeBreaks(span: Span, work: readonly WorkItem[], young: YoungBand | null): ShiftPart {
  const owed = breakEntitlement(span.end - span.start, young);
  const free = subtract(span, work);
  const breaks: PlacedBreak[] = [];
  const unplaced: ShiftPart["unplaced"] = [];
  const length = span.end - span.start;
  owed.forEach((b, i) => {
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
    if (best === null) unplaced.push(b);
    else breaks.push({ start: best, end: best + b.minutes, paid: b.paid });
  });
  return { ...span, work: [...work].sort((a, b) => a.start - b.start), breaks: breaks.sort((a, b) => a.start - b.start), unplaced };
}

/** "7h 30m", "45m", "8h". */
export function duration(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}
