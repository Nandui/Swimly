/** Dates and times as the centres read them. "What day is it?" is asked in Europe/Dublin,
 *  never on the server's clock. */
const ZONE = "Europe/Dublin";

export const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;
export type Day = (typeof DAYS)[number];

/** The weekday in Dublin at this moment, as the timetable stores it. */
export function dayIn(now: Date = new Date()): Day {
  const name = new Intl.DateTimeFormat("en-IE", { timeZone: ZONE, weekday: "long" }).format(now).toUpperCase();
  const day = DAYS.find((d) => d === name);
  if (!day) throw new Error(`Unknown weekday: ${name}`);
  return day;
}

/** "Friday 27 November". */
export function longDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-IE", { timeZone: ZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
}

/** Minutes from midnight as "16:30". Class times are stored this way: a weekly time has no date. */
export function clock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
