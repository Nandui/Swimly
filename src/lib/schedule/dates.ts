import { isDateOnly, parseDateOnly, toDateOnlyString, today } from "@/lib/format";

const DAY_MS = 86_400_000;

export function scheduleDate(requested: unknown, now = new Date()) {
  return isDateOnly(requested) ? requested : today(now);
}

export function scheduleHref(date?: unknown) {
  return isDateOnly(date) ? `/schedule?date=${date}` : "/schedule";
}

/** Calendar arithmetic uses date-only UTC values, not elapsed local days. */
export function scheduleWeek(iso: string) {
  const date = parseDateOnly(iso);
  const monday = date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY_MS;
  return Array.from({ length: 7 }, (_, index) => toDateOnlyString(new Date(monday + index * DAY_MS)));
}

/** Future days have no live clock; past days have already finished. */
export function scheduleNow(iso: string, currentDate: string, minutes: number): number | null {
  return iso === currentDate ? minutes : iso < currentDate ? 1440 : null;
}
