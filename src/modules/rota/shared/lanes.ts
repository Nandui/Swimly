/** Pools with lanes (owner request, 13 October 2026: "define a pool, and how many lanes it has,
 *  then a booking needs to use the whole pool or single lanes or a combination"). An area says how
 *  many lanes it has (Admin, Areas); an activity or booking takes some of them, or none for the
 *  whole area. Pure, so it is tested on its own (lanes.test.ts). */

import { MAX_LANES } from "@/lib/setup/lanes";

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

/** Labels and a swim class's lanes are worded once, in Admin's areas (src/lib/setup/lanes.ts). */
export { lanesInPlace, lanesLabel } from "@/lib/setup/lanes";

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
