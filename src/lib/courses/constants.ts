import type { DayOfWeek } from "@/generated/prisma/client";

/** Domain vocabulary for a class in the timetable. No call site composes a
 *  time string — "16:30" is one function, and so is "Mondays, 16:30–17:00". */

export const DAY_META: Record<DayOfWeek, { label: string; short: string; index: number }> = {
  MONDAY: { label: "Monday", short: "Mon", index: 0 },
  TUESDAY: { label: "Tuesday", short: "Tue", index: 1 },
  WEDNESDAY: { label: "Wednesday", short: "Wed", index: 2 },
  THURSDAY: { label: "Thursday", short: "Thu", index: 3 },
  FRIDAY: { label: "Friday", short: "Fri", index: 4 },
  SATURDAY: { label: "Saturday", short: "Sat", index: 5 },
  SUNDAY: { label: "Sunday", short: "Sun", index: 6 },
};

export const DAYS_IN_ORDER = (Object.keys(DAY_META) as DayOfWeek[]).sort(
  (a, b) => DAY_META[a].index - DAY_META[b].index
);

/** Minutes from midnight → "16:30". */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

/** "16:30" → 990. Returns null for anything that is not a 24-hour clock time. */
export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

type Slot = { dayOfWeek: DayOfWeek; startMinutes: number; durationMinutes: number };

/** "Mondays, 16:30–17:00" — how someone plans around it. */
export function formatSlot(slot: Slot): string {
  return `${DAY_META[slot.dayOfWeek].label}s, ${formatTime(slot.startMinutes)}–${formatTime(
    slot.startMinutes + slot.durationMinutes
  )}`;
}

/** "Mon 16:30" — the compact form, for a column or a picker. */
export function formatSlotShort(slot: {
  dayOfWeek: DayOfWeek;
  startMinutes: number;
}): string {
  return `${DAY_META[slot.dayOfWeek].short} ${formatTime(slot.startMinutes)}`;
}

/** "Dolphins · Mon 16:30". A course does not have to be named — most schools
 *  call the class by its level — so this falls back to the level. */
export function courseLabel(course: {
  name: string | null;
  dayOfWeek: DayOfWeek;
  startMinutes: number;
  level: { name: string };
}): string {
  return `${course.name ?? course.level.name} · ${formatSlotShort(course)}`;
}

export function courseName(course: { name: string | null; level: { name: string } }): string {
  return course.name ?? course.level.name;
}

/** "12 of 16", or just the headcount when the class is uncapped. */
export function capacityLabel(taken: number, capacity: number | null): string {
  return capacity === null ? `${taken} enrolled` : `${taken} of ${capacity}`;
}

/** A full class is not urgent, it is just full — so it reads yellow, and only
 *  a class that has been pushed past its own limit gets red. */
export function capacityTone(
  taken: number,
  capacity: number | null
): { label: string; color: "red" | "yellow" } | null {
  if (capacity === null) return null;
  if (taken > capacity) return { label: `${taken - capacity} over`, color: "red" };
  if (taken >= capacity) return { label: "Full", color: "yellow" };
  return null;
}

export function placesLeft(taken: number, capacity: number | null): number | null {
  return capacity === null ? null : Math.max(0, capacity - taken);
}
