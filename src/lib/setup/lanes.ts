/** A pool's lanes, as one "where" text (owner request, 19 October 2026: "some activities /
 *  bookings might only use a certain lane or combination of lanes"). An area says how many lanes
 *  it has (Admin, Areas); a swim class, an assessment or a short course session that takes some
 *  of them saves them after the area, as it always has: "Main pool, lane 3", "Main pool, lanes 1
 *  to 3", "Main pool, lanes 1, 3 and 5". Naming none is the whole pool. Pure, so server, client
 *  and every module read it the same way (lanes.test.ts). No imports, so the UI kit may use it
 *  (eslint.config.mjs files it with the UI kit, as src/lib/utils.ts). */

/** The most lanes an area may have. */
export const MAX_LANES = 20;

/** "Whole pool", "Lane 3", "Lanes 1 to 3", "Lanes 1, 3 and 5". */
export function lanesLabel(lanes: readonly number[], count: number) {
  const real = lanes.filter((l) => l >= 1 && (!count || l <= count));
  if (!real.length || (count && real.length >= count)) return "Whole pool";
  if (real.length === 1) return `Lane ${real[0]}`;
  const run = real.every((l, i) => i === 0 || l === real[i - 1] + 1);
  return run ? `Lanes ${real[0]} to ${real[real.length - 1]}` : `Lanes ${real.slice(0, -1).join(", ")} and ${real[real.length - 1]}`;
}

/** The lanes words in a location's detail, and the rest of the detail without them:
 *  "lanes 1, 3 and 5, shallow end" → [1, 3, 5] and "shallow end". */
const LANE_WORDS = /\blanes?\s*(\d+(?:\s*(?:,|-|–|to|and|&)\s*\d+)*)/i;
export function lanesInDetail(detail: string): { lanes: number[]; rest: string } {
  const m = LANE_WORDS.exec(detail);
  if (!m) return { lanes: [], rest: detail.trim() };
  const lanes = new Set<number>();
  // "3-4" and "2 to 4" are runs; commas, "and" and "&" list single lanes.
  for (const part of m[1].split(/\s*(?:,|and|&)\s*/i)) {
    const [a, b = a] = part.split(/\s*(?:-|–|to)\s*/i).map(Number);
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    if (hi - lo > MAX_LANES) continue;
    for (let l = lo; l <= hi; l++) if (l >= 1 && l <= MAX_LANES) lanes.add(l);
  }
  const rest = (detail.slice(0, m.index) + detail.slice(m.index + m[0].length)).replace(/^[\s,]+|[\s,]+$/g, "").replace(/\s*,\s*,\s*/g, ", ");
  return { lanes: [...lanes].sort((x, y) => x - y), rest };
}

/** The lanes a location names after its area: "Main pool, lane 3" or "Main pool, lanes 3-4".
 *  None when it names no lane. */
export function lanesInPlace(place: string) {
  return lanesInDetail(place.split(",").slice(1).join(",")).lanes;
}

/** The detail after an area for these lanes and any other words: "lanes 1 to 3, shallow end".
 *  The whole pool adds no lane words. */
export function laneDetail(lanes: readonly number[], count: number, rest = "") {
  const words = lanes.length && count ? lanesLabel(lanes, count) : "Whole pool";
  return [words === "Whole pool" ? "" : words.toLowerCase(), rest.trim()].filter(Boolean).join(", ");
}

/** "Learner pool, lane 3" → the area and the detail after it, when the text starts with an area. */
export function splitLocation(value: string | null | undefined, areas: readonly string[]): { area: string; detail: string } {
  const text = (value ?? "").trim();
  if (!text) return { area: "", detail: "" };
  const lower = text.toLowerCase();
  const area = [...areas].sort((a, b) => b.length - a.length).find((a) => lower === a.toLowerCase() || lower.startsWith(`${a.toLowerCase()},`));
  if (!area) return { area: "", detail: text };
  return { area, detail: text.slice(area.length).replace(/^,\s*/, "") };
}

/** The area and its detail as one location: "Learner pool, lane 3". */
export function joinLocation(area: string, detail: string) {
  return [area.trim(), detail.trim()].filter(Boolean).join(", ");
}
