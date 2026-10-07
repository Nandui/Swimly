/** The stretch of the day the timeline shows (owner request, 6 October 2026: drag empty space to
 *  move, scroll to zoom). Minutes from midnight. Pure, so the limits are tested (view.test.ts). */

export type View = { from: number; to: number };

/** Zoomed in as far as an hour across the whole width. */
export const MIN_SPAN = 60;

const clampInto = (v: View, bounds: View): View => {
  const span = Math.min(v.to - v.from, bounds.to - bounds.from);
  const from = Math.min(Math.max(v.from, bounds.from), bounds.to - span);
  return { from, to: from + span };
};

/** Zoom by `factor` (under 1 zooms in) keeping the minute `at` under the pointer where it is. */
export function zoomView(v: View, bounds: View, at: number, factor: number): View {
  const span = v.to - v.from;
  const next = Math.min(Math.max(span * factor, MIN_SPAN), bounds.to - bounds.from);
  const ratio = span ? (at - v.from) / span : 0.5;
  return clampInto({ from: at - ratio * next, to: at - ratio * next + next }, bounds);
}

/** Move the view by `minutes` (positive is later), never past the day's ends. */
export function panView(v: View, bounds: View, minutes: number): View {
  return clampInto({ from: v.from + minutes, to: v.to + minutes }, bounds);
}

/** How far apart the hour labels sit: two hours across a long view, down to every quarter hour. */
export function tickStep(span: number) {
  return span > 8 * 60 ? 120 : span > 3 * 60 ? 60 : span > 90 ? 30 : 15;
}

/** The first labelled time in a view: its first whole hour (or quarter hour, zoomed right in), so
 *  a day from 07:00 reads 07:00, 09:00 and on rather than 08:00, 10:00. */
export function firstTick(v: View) {
  const base = Math.min(tickStep(v.to - v.from), 60);
  return Math.ceil(v.from / base) * base;
}

/** The labelled times in a view, on its step. */
export function ticks(v: View) {
  const step = tickStep(v.to - v.from);
  const out: number[] = [];
  for (let t = firstTick(v); t <= v.to; t += step) out.push(t);
  return out;
}

export const sameView = (a: View, b: View) => Math.abs(a.from - b.from) < 0.5 && Math.abs(a.to - b.to) < 0.5;
