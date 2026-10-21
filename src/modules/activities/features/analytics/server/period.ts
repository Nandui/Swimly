import { addDaysIso, today } from "@/lib/format";
import { scheduleWeek } from "@/modules/activities/shared/schedule/dates";

/** The preset periods every analytics page offers. Each ends today and starts on a
 *  Monday, so weekly figures line up; the previous period is the same length
 *  straight before it, for the comparisons. Any other dates are a custom period. */
export const RANGES = [
  { key: "4w", weeks: 4, label: "4 weeks" },
  { key: "13w", weeks: 13, label: "13 weeks" },
  { key: "26w", weeks: 26, label: "6 months" },
  { key: "52w", weeks: 52, label: "12 months" },
] as const;
export type RangeKey = typeof RANGES[number]["key"];
export const DEFAULT_RANGE: RangeKey = "13w";

export function rangeKey(value: unknown): RangeKey {
  return RANGES.find(range => range.key === first(value))?.key ?? DEFAULT_RANGE;
}

/** A date written as YYYY-MM-DD that is a real calendar day. */
function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

/** The longest custom period: three years, so a report never reads more than six years of rows. */
const MAX_CUSTOM_DAYS = 3 * 366;

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export type ReportPeriod = {
  key: RangeKey | "custom"; label: string; weeksCount: number;
  /** The day the "now" figures are read on: today, or the last day of a custom period that ended earlier. */
  today: string; start: string; end: string; previousStart: string; previousEnd: string;
  /** Monday of each week the period touches, for weekly figures. */
  weeks: string[];
  /** True when the period runs to today, so "now" figures and the next four weeks are live. */
  current: boolean;
  /** The real today, whatever the period. */
  now: string;
};

export function reportPeriod(key: RangeKey, now = new Date()): ReportPeriod {
  const range = RANGES.find(r => r.key === key)!;
  const date = today(now);
  const monday = scheduleWeek(date)[0];
  const start = addDaysIso(monday, -(range.weeks - 1) * 7);
  const previousStart = addDaysIso(start, -range.weeks * 7);
  const previousEnd = addDaysIso(start, -1);
  const weeks = Array.from({ length: range.weeks }, (_, i) => addDaysIso(start, i * 7));
  return { key: range.key, label: range.label, weeksCount: range.weeks, today: date, start, end: date, previousStart, previousEnd, weeks, current: true, now: date };
}

/** A period between two chosen days (owner request, 16 October 2026: "custom filters for dates").
 *  The end is never after today, the start never after the end, and at most three years apart.
 *  The comparison is the same number of days straight before it. */
export function customPeriod(from: string, to: string, now = new Date()): ReportPeriod {
  const date = today(now);
  const end = to > date ? date : to;
  let start = from > end ? end : from;
  if (daysBetween(start, end) >= MAX_CUSTOM_DAYS) start = addDaysIso(end, -(MAX_CUSTOM_DAYS - 1));
  const days = daysBetween(start, end) + 1;
  const weeks: string[] = [];
  for (let week = scheduleWeek(start)[0]; week <= end; week = addDaysIso(week, 7)) weeks.push(week);
  return {
    key: "custom", label: days % 7 === 0 ? `${days / 7} ${days === 7 ? "week" : "weeks"}` : `${days} ${days === 1 ? "day" : "days"}`,
    weeksCount: weeks.length, today: end, start, end,
    previousStart: addDaysIso(start, -days), previousEnd: addDaysIso(start, -1), weeks, current: end === date, now: date,
  };
}

/** The period from the page's search parameters: `from` and `to` together make a custom period,
 *  otherwise `range` picks a preset. */
export function periodFrom(params: { range?: unknown; from?: unknown; to?: unknown }, now = new Date()): ReportPeriod {
  const from = isoDate(first(params.from)), to = isoDate(first(params.to));
  return from && to ? customPeriod(from, to, now) : reportPeriod(rangeKey(first(params.range)), now);
}

function first(value: unknown) {
  return Array.isArray(value) ? value[0] : value;
}

/** Which sites a report covers: the site picked in the sidebar, or every site
 *  the person works at. From the `sites` search parameter. */
export type SiteScope = "site" | "all";
export function siteScope(value: unknown): SiteScope {
  return first(value) === "all" ? "all" : "site";
}

/** Everything a report is filtered by, carried from page to page in the address. */
export type ReportFilters = { period: Pick<ReportPeriod, "key" | "start" | "end">; scope: SiteScope; programme?: string | null };

/** Query string for links that keep the chosen period, sites and programme. */
export function reportQuery(filters: ReportFilters, extra: Record<string, string> = {}) {
  const params = new URLSearchParams();
  if (filters.period.key === "custom") { params.set("from", filters.period.start); params.set("to", filters.period.end); }
  else if (filters.period.key !== DEFAULT_RANGE) params.set("range", filters.period.key);
  if (filters.scope === "all") params.set("sites", "all");
  if (filters.programme) params.set("programme", filters.programme);
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
