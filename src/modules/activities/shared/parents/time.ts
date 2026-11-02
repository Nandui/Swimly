import { dublinInstant, today } from "@/lib/format";

export const PARENT_TIMEZONE = "Europe/Dublin";

/** Moved to the platform once HR needed it too; kept here for the swim school's callers. */
export { dublinInstant };

export function nextDublinMidnight(now: Date): Date {
  const next = new Date(`${today(now)}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return dublinInstant(next.toISOString().slice(0, 10), 0)!;
}
