/** Pools with lanes (owner request, 13 October 2026: "define a pool, and how many lanes it has,
 *  then a booking needs to use the whole pool or single lanes or a combination"). An area says how
 *  many lanes it has (Admin, Areas); an activity or booking takes some of them, or none for the
 *  whole area. Pure, so it is tested on its own (lanes.test.ts). */

/** The most lanes an area may have. */
export const MAX_LANES = 20;

/** The lanes chosen on a form, as a sorted list without repeats. Empty means the whole area. */
export function lanesFrom(values: readonly unknown[]): number[] {
  return [...new Set(values.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n >= 1 && n <= MAX_LANES))].sort((a, b) => a - b);
}

/** Why these lanes don't fit the area, or null when they do. */
export function lanesProblem(lanes: readonly number[], count: number, area: string) {
  if (!lanes.length) return null;
  if (!count) return `${area || "That area"} has no lanes. Leave the lanes out, or give it lanes in Admin, Areas.`;
  const over = lanes.filter((l) => l > count);
  return over.length ? `${area} has ${count} ${count === 1 ? "lane" : "lanes"}, so there is no lane ${over.join(", ")}.` : null;
}

/** The lanes something actually takes in an area with `count` lanes: every lane when it names
 *  none (the whole area), else the ones that still exist. */
export function lanesTaken(lanes: readonly number[], count: number): number[] {
  const real = lanes.filter((l) => l >= 1 && l <= count);
  return real.length ? real : Array.from({ length: count }, (_, i) => i + 1);
}

/** Do two things in the same area share a lane? Naming no lanes takes them all. */
export function lanesMeet(a: readonly number[], b: readonly number[], count: number) {
  if (!count) return true;
  const mine = new Set(lanesTaken(a, count));
  return lanesTaken(b, count).some((l) => mine.has(l));
}

/** "Whole pool", "Lane 3", "Lanes 1 to 3", "Lanes 1, 3 and 5". */
export function lanesLabel(lanes: readonly number[], count: number) {
  const real = lanes.filter((l) => l >= 1 && (!count || l <= count));
  if (!real.length || (count && real.length >= count)) return "Whole pool";
  if (real.length === 1) return `Lane ${real[0]}`;
  const run = real.every((l, i) => i === 0 || l === real[i - 1] + 1);
  return run ? `Lanes ${real[0]} to ${real[real.length - 1]}` : `Lanes ${real.slice(0, -1).join(", ")} and ${real[real.length - 1]}`;
}

/** The lanes a swim class's location names after its area: "Main pool, lane 3" or
 *  "Main pool, lanes 3-4". None when it names no lane. */
export function lanesInPlace(place: string): number[] {
  const detail = place.split(",").slice(1).join(",");
  const m = /lanes?\s*(\d+)(?:\s*(?:-|–|to|and|&)\s*(\d+))?/i.exec(detail);
  if (!m) return [];
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return hi - lo > MAX_LANES ? [] : Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter((l) => l <= MAX_LANES);
}

/** Two bookings that hold the same lane at the same time, on a day they both run: the first
 *  clash found, or null (owner default, 13 October 2026: two bookings can't hold the same lane).
 *  Only areas with lanes are checked; days are ISO dates. */
export type LaneBooking = { id?: string; title: string; place: string; lanes: readonly number[]; start: number; end: number; dates: readonly string[] };
export function laneClash(mine: LaneBooking, others: readonly LaneBooking[], count: number): { other: LaneBooking; date: string } | null {
  if (!count) return null;
  const days = new Set(mine.dates);
  for (const o of others) {
    if (o.id && o.id === mine.id) continue;
    if (o.place.trim().toLowerCase() !== mine.place.trim().toLowerCase()) continue;
    if (!(o.start < mine.end && mine.start < o.end)) continue;
    if (!lanesMeet(mine.lanes, o.lanes, count)) continue;
    const date = o.dates.find((d) => days.has(d));
    if (date) return { other: o, date };
  }
  return null;
}
