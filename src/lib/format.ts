/** Where the pool is. Calendar decisions use this zone, not the server's. */
export const SCHOOL_TIMEZONE = "Europe/Dublin";

/** Every date, time and count on screen comes from this file, in one locale,
 *  so the same day reads the same way everywhere ("Sunday 4 October",
 *  "Sun 4 Oct", "28 Sep to 4 Oct", "16:00 to 16:30"). Pinned rather than taken
 *  from the request, because a date that changes shape between two tables is
 *  a date nobody can scan down a column. */
const LOCALE = "en-GB";

/** en-GB abbreviates September as "Sept" next to "Oct"; every other month is
 *  three letters. Only the month part is touched, so literals such as the
 *  ", " before a time survive. Built from parts so server and browser agree. */
function formatParts(formatter: Intl.DateTimeFormat, value: Date): string {
  return formatter
    .formatToParts(value)
    .map((part) => (part.type === "month" && part.value === "Sept" ? "Sep" : part.value))
    .join("");
}

function partsOf(formatter: Intl.DateTimeFormat, value: Date) {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(value)) {
    parts[part.type] = part.type === "month" && part.value === "Sept" ? "Sep" : part.value;
  }
  return parts;
}

/** A date-only value: a `YYYY-MM-DD` string or a `@db.Date` (UTC midnight). */
type DayValue = Date | string;

function asDay(value: DayValue): Date {
  return typeof value === "string" ? parseDateOnly(value) : value;
}

const DATE_TIME = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: SCHOOL_TIMEZONE,
});

export function formatDateTime(value: Date): string {
  return formatParts(DATE_TIME, value);
}

/** Date-only columns (`@db.Date`) come back as a `Date` at **UTC midnight**.
 *  Formatting one in local time shows the previous day anywhere west of
 *  Greenwich, so this pins UTC. Use it for anything stored as a date rather
 *  than an instant: a register date, a date of birth, a completion date. */
const DATE_ONLY = new Intl.DateTimeFormat(LOCALE, {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: Date): string {
  return formatParts(DATE_ONLY, value);
}

const DAY_PARTS = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DAY_PARTS = new Intl.DateTimeFormat(LOCALE, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const MONTH_PARTS = new Intl.DateTimeFormat(LOCALE, {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function currentYear(now: Date): string {
  return today(now).slice(0, 4);
}

/** "Sunday 4 October": a day named in full, as a heading or a label. The year
 *  is added only when it is not this year at the pool ("Friday 1 January
 *  2027"). Date-only values are read in UTC, as `formatDate` does. */
export function formatDay(value: DayValue, now: Date = new Date()): string {
  const parts = partsOf(DAY_PARTS, asDay(value));
  const year = parts.year === currentYear(now) ? "" : ` ${parts.year}`;
  return `${parts.weekday} ${parts.day} ${parts.month}${year}`;
}

/** "Sun 4 Oct": the compact day, for a column, a chip or a week strip. */
export function formatShortDay(value: DayValue): string {
  const parts = partsOf(SHORT_DAY_PARTS, asDay(value));
  return `${parts.weekday} ${parts.day} ${parts.month}`;
}

/** "Sun" or "Sunday": the weekday alone, for a day column headed by its date. */
export function formatWeekday(value: DayValue, width: "long" | "short" = "long"): string {
  const parts = partsOf(width === "long" ? DAY_PARTS : SHORT_DAY_PARTS, asDay(value));
  return parts.weekday ?? "";
}

/** "4 Oct": day and month with no weekday or year. */
export function formatDayMonth(value: DayValue): string {
  const parts = partsOf(SHORT_DAY_PARTS, asDay(value));
  return `${parts.day} ${parts.month}`;
}

/** "October 2026": a whole month, for a report period. */
export function formatMonth(value: DayValue): string {
  const parts = partsOf(MONTH_PARTS, asDay(value));
  return `${parts.month} ${parts.year}`;
}

/** "28 Sep to 4 Oct". Both ends carry the year when the range crosses a year
 *  or is not this year ("28 Dec 2026 to 3 Jan 2027"). Never Intl's
 *  formatRange, which joins with an en dash. */
export function formatDateRange(from: DayValue, to: DayValue, now: Date = new Date()): string {
  const start = partsOf(SHORT_DAY_PARTS, asDay(from));
  const end = partsOf(SHORT_DAY_PARTS, asDay(to));
  const withYear = start.year !== end.year || start.year !== currentYear(now);
  const label = (parts: typeof start) => `${parts.day} ${parts.month}${withYear ? ` ${parts.year}` : ""}`;
  return `${label(start)} to ${label(end)}`;
}

/** Minutes from midnight → "16:30". The unit a class's `startMinutes` and a
 *  shift's times are kept in. */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** Two clock times in minutes → "16:30 to 17:15". */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  return `${formatTime(startMinutes)} to ${formatTime(endMinutes)}`;
}

const COUNT = new Intl.NumberFormat(LOCALE);

/** A bare count with grouping, "1,204", for figures without a noun (a pager's "1 to 25 of 1,102"). */
export function formatCount(n: number): string {
  return COUNT.format(n);
}

/** "1 swimmer", "12 swimmers", "1,204 swimmers". Pass `many` when the plural
 *  is not the singular plus "s" ("1 class", "3 classes"). */
export function plural(n: number, one: string, many: string = `${one}s`): string {
  return `${COUNT.format(n)} ${n === 1 ? one : many}`;
}

/** `en-CA` is the shortest way to a real `YYYY-MM-DD` out of `Intl`. */
const ISO_IN_SCHOOL_TIME = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: SCHOOL_TIMEZONE,
});

/** Today at the pool, as `YYYY-MM-DD`. The register's whole notion of "now". */
export function today(now: Date = new Date()): string {
  return ISO_IN_SCHOOL_TIME.format(now);
}

const CLOCK_IN_SCHOOL_TIME = new Intl.DateTimeFormat(LOCALE, {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: SCHOOL_TIMEZONE,
});

/** The time at the pool right now, as minutes past midnight — the same unit
 *  a class's `startMinutes` is kept in, so "is this class on now?" is one
 *  comparison. Read in the school's zone for the same reason `today()` is. */
export function minutesNow(now: Date = new Date()): number {
  const [hours, minutes] = CLOCK_IN_SCHOOL_TIME.format(now).split(":").map(Number);
  return hours * 60 + minutes;
}

/** `YYYY-MM-DD` → the `Date` a `@db.Date` column round-trips: UTC midnight.
 *  Nothing else may construct a register date — `new Date(2026, 7, 14)` is
 *  *local* midnight and lands on the wrong day for half the world. */
export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Validate the calendar day as well as its shape; Date normalises 31 February. */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateOnly(value);
  return Number.isFinite(date.getTime()) && toDateOnlyString(date) === value;
}

/** A `@db.Date` value back to `YYYY-MM-DD`, for round-tripping through a URL
 *  or a form field. */
export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const WEEKDAY_IN_UTC = new Intl.DateTimeFormat(LOCALE, {
  weekday: "long",
  timeZone: "UTC",
});

/** The weekday of a date-only value, read in UTC so it matches the stored day
 *  rather than the server's. Used to refuse a register dated on a day the
 *  class does not run. */
export function weekdayOf(value: Date): string {
  return WEEKDAY_IN_UTC.format(value).toUpperCase();
}

/** Whole years, for a date of birth. Computed in UTC on both sides so it never
 *  flips a day early. */
export function ageInYears(dateOfBirth: Date, now: Date = new Date()): number {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/** Up to two initials from a person's name, for an avatar fallback. The only initials helper:
 *  server-safe, and re-exported by the (client) Avatar module as `initials`. */
export function nameInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("");
}
