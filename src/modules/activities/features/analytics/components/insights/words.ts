import { formatCount, formatDayMonth } from "@/lib/format";
import type { ReportPeriod } from "@/modules/activities/features/analytics/server/period";

/** Figures said as words, for readers who are not analysts: "18 more than the 13 weeks before". */

const one = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

/** "the 13 weeks before", for sentences comparing with the previous period. */
export function before(period: ReportPeriod) {
  return `the ${period.label} before`;
}

/** How a figure moved against the one before, as a short phrase and whether that was good. */
export function moved(current: number | null, previous: number | null, options: { better: "up" | "down" | "none"; pts?: boolean; against: string }) {
  if (current === null || previous === null) return undefined;
  const diff = current - previous;
  const size = options.pts ? Math.round(Math.abs(diff) * 10) / 10 : Math.round(Math.abs(diff));
  if (size === 0) return { text: `Same as ${options.against}` };
  const up = diff > 0;
  const text = options.pts
    ? `${up ? "Up" : "Down"} ${one.format(size)} ${size === 1 ? "point" : "points"} on ${options.against}`
    : `${formatCount(size)} ${up ? "more" : "fewer"} than ${options.against}`;
  const tone = options.better === "none" ? undefined : up === (options.better === "up") ? "good" as const : "bad" as const;
  return { text, tone };
}

/** "Week of 4 Aug". */
export function weekOf(week: string) {
  return `Week of ${formatDayMonth(week)}`;
}

/** The busiest of a weekly series, as "the week of 4 Aug". */
export function busiest<T extends { week: string }>(rows: T[], value: (row: T) => number) {
  let best: T | null = null, top = -Infinity;
  for (const r of rows) { const v = value(r); if (v > top) { top = v; best = r; } }
  return best && top > 0 ? `the week of ${formatDayMonth(best.week)}` : null;
}
