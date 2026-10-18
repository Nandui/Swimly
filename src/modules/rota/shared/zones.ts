import type { ZoneBand, ZoneItem } from "@/modules/rota/shared/day";
import { lanesTaken } from "@/modules/rota/shared/lanes";

/** The rows an area takes in the zones at the top of the Plan (owner request, 13 October 2026:
 *  "define a pool, and how many lanes it has"). An area without lanes is one row, more when things
 *  in it overlap. A pool with lanes has a row across it first, for what covers the whole pool
 *  without taking a lane (lifeguarding, a class with no lane), then a row per lane holding what
 *  takes that lane: a booking of the whole pool takes every lane. Pure (zones.test.ts). */
export type BandRow = {
  key: string;
  /** The lane, or null for the area's own row. */
  lane: number | null;
  /** The first row of the area: it carries the area's name. */
  head: boolean;
  items: ZoneItem[];
  /** Items on this lane that overlap another there at the same time. */
  clashes: string[];
};

/** Things into as few rows as fit without overlapping, in time order. */
function packRows(items: readonly ZoneItem[]): ZoneItem[][] {
  const rows: ZoneItem[][] = [];
  for (const item of [...items].sort((a, b) => a.start - b.start || b.end - a.end)) {
    const row = rows.find((r) => r[r.length - 1].end <= item.start);
    if (row) row.push(item); else rows.push([item]);
  }
  return rows;
}

function overlapping(items: readonly ZoneItem[]) {
  const out = new Set<string>();
  for (const a of items) for (const b of items) if (a !== b && a.start < b.end && b.start < a.end) out.add(a.key);
  return [...out];
}

export function bandRows(band: ZoneBand): BandRow[] {
  if (!band.lanes) {
    const rows = packRows(band.items);
    return (rows.length ? rows : [[]]).map((items, i) => ({ key: `${band.key}|${i}`, lane: null, head: i === 0, items, clashes: [] }));
  }
  const across = band.items.filter((i) => !i.lanes.length && i.kind !== "booking");
  const laned = band.items.filter((i) => !across.includes(i));
  const top = packRows(across);
  const out: BandRow[] = (top.length ? top : [[]]).map((items, i) => ({ key: `${band.key}|all|${i}`, lane: null, head: i === 0, items, clashes: [] }));
  for (let lane = 1; lane <= band.lanes; lane++) {
    const here = laned.filter((i) => lanesTaken(i.lanes, band.lanes).includes(lane));
    const clashes = overlapping(here);
    const rows = packRows(here);
    (rows.length ? rows : [[]]).forEach((items, i) => out.push({ key: `${band.key}|${lane}|${i}`, lane, head: false, items, clashes }));
  }
  return out;
}
