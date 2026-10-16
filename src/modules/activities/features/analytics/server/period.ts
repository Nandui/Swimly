import { addDaysIso, today } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/shared/schedule/dates";

/** The periods every analytics page offers. Each ends today and starts on a
 *  Monday, so weekly figures line up; the previous period is the same length
 *  straight before it, for the comparisons. */
export const RANGES = [
  { key: "4w", weeks: 4, label: "4 weeks" },
  { key: "13w", weeks: 13, label: "13 weeks" },
  { key: "26w", weeks: 26, label: "6 months" },
  { key: "52w", weeks: 52, label: "12 months" },
] as const;
export type RangeKey = typeof RANGES[number]["key"];
export const DEFAULT_RANGE: RangeKey = "13w";

export function rangeKey(value: unknown): RangeKey {
  return RANGES.find(range => range.key === value)?.key ?? DEFAULT_RANGE;
}

export type ReportPeriod = ReturnType<typeof reportPeriod>;

export function reportPeriod(key: RangeKey, now = new Date()) {
  const range = RANGES.find(r => r.key === key)!;
  const date = today(now);
  const monday = scheduleWeek(date)[0];
  const start = addDaysIso(monday, -(range.weeks - 1) * 7);
  const previousStart = addDaysIso(start, -range.weeks * 7);
  const previousEnd = addDaysIso(start, -1);
  const weeks = Array.from({ length: range.weeks }, (_, i) => addDaysIso(start, i * 7));
  return { key: range.key, label: range.label, weeksCount: range.weeks, today: date, start, end: date, previousStart, previousEnd, weeks };
}

/** Which sites a report covers: the site picked in the sidebar, or every site
 *  the person works at. From the `sites` search parameter. */
export type SiteScope = "site" | "all";
export function siteScope(value: unknown): SiteScope {
  return value === "all" ? "all" : "site";
}

/** Query string for links that keep the chosen period and sites. */
export function reportQuery(key: RangeKey, scope: SiteScope, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (key !== DEFAULT_RANGE) params.set("range", key);
  if (scope === "all") params.set("sites", "all");
  for (const [name, value] of Object.entries(extra)) params.set(name, value);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Calendar months (first days) ending with the current one. */
export function lastMonths(date: string, count: number) {
  const [year, month] = date.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 10);
  });
}

export function weeksBetween(from: string, to: string) {
  return Math.max(0, (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / (7 * 86_400_000));
}
