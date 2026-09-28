import { isDateOnly, today } from "@/lib/format";

export const PARENT_TIMEZONE = "Europe/Dublin";

/** Resolve wall time without using the server timezone. Ambiguous autumn times
 * use the earlier occurrence; nonexistent spring times are rejected. */
export function dublinInstant(date: string, minutes: number): Date | null {
  if (!isDateOnly(date) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 1440) return null;
  const desired = new Date(`${date}T00:00:00Z`).getTime() + minutes * 60_000;
  const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: PARENT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  // Dublin's current civil time is UTC or UTC+1. Match wall time explicitly.
  for (const offset of [60, 0]) {
    const instant = new Date(desired - offset * 60_000);
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(p => [p.type, p.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === date && Number(parts.hour) * 60 + Number(parts.minute) === minutes) return instant;
  }
  return null;
}

export function nextDublinMidnight(now: Date): Date {
  const next = new Date(`${today(now)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return dublinInstant(next.toISOString().slice(0, 10), 0)!;
}
