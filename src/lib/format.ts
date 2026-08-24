/** One formatter, one locale, so the same instant reads the same way on every
 *  screen. Pinned rather than taken from the request, because a date that
 *  changes shape between two tables is a date nobody can scan down a column. */
const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: Date): string {
  return DATE_TIME.format(value);
}

/** Where the pool is. Everything that asks "what day is it?" asks it here, not
 *  of the server, which may well be in another country. */
export const SCHOOL_TIMEZONE = "Europe/Dublin";

/** Date-only columns (`@db.Date`) come back as a `Date` at **UTC midnight**.
 *  Formatting one in local time shows the previous day anywhere west of
 *  Greenwich, so this pins UTC. Use it for anything stored as a date rather
 *  than an instant: a register date, a date of birth, a completion date. */
const DATE_ONLY = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(value: Date): string {
  return DATE_ONLY.format(value);
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

/** `YYYY-MM-DD` → the `Date` a `@db.Date` column round-trips: UTC midnight.
 *  Nothing else may construct a register date — `new Date(2026, 7, 14)` is
 *  *local* midnight and lands on the wrong day for half the world. */
export function parseDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** A `@db.Date` value back to `YYYY-MM-DD`, for round-tripping through a URL
 *  or a form field. */
export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const WEEKDAY_IN_UTC = new Intl.DateTimeFormat("en-GB", {
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
