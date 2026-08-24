import type { DayOfWeek } from "@/generated/prisma/client";
import { parseDateOnly, toDateOnlyString, today, weekdayOf } from "@/lib/format";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

/** The last time this class actually ran, on or before `from`.
 *
 *  The register defaults to this rather than to today, so opening Monday's
 *  register on a Tuesday lands on yesterday's class instead of on the guard
 *  that refuses a register dated on the wrong weekday. */
export function mostRecentOccurrence(day: DayOfWeek, from: string = today()): string {
  const start = parseDateOnly(from);
  for (let back = 0; back < 7; back += 1) {
    const candidate = new Date(start.getTime() - back * DAY_MS);
    if (weekdayOf(candidate) === day) return toDateOnlyString(candidate);
  }
  return from;
}

/** Step a whole number of weeks, which keeps the weekday — and so keeps the
 *  date valid for the same course. */
export function shiftWeeks(iso: string, weeks: number): string {
  return toDateOnlyString(new Date(parseDateOnly(iso).getTime() + weeks * 7 * DAY_MS));
}

export function weekdayOfIso(iso: string): DayOfWeek {
  return weekdayOf(parseDateOnly(iso)) as DayOfWeek;
}
