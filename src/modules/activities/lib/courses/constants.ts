import { Clock3, Play, TriangleAlert, UserRoundX, Users } from "lucide-react";
import type { DayOfWeek } from "@/generated/prisma/client";
import type { StatusMeta } from "@/lib/status";
import { formatTime, formatTimeRange } from "@/lib/format";

export const COURSE_STATUS_META = {
  unassigned: { label: "Unassigned", color: "orange", icon: UserRoundX },
} as const satisfies Record<string, StatusMeta>;

export const COURSE_PHASE_META = {
  now: { label: "Now", color: "blue", icon: Play },
  next: { label: "Next", color: "gray", icon: Clock3 },
} as const satisfies Record<string, StatusMeta>;

/** A full class is not urgent, it is just full; only a class pushed past its
 *  own limit gets red. */
export const CAPACITY_META = {
  full: { label: "Full", color: "orange", icon: Users },
  over: { label: "Over capacity", color: "red", icon: TriangleAlert },
} as const satisfies Record<string, StatusMeta>;

/** Domain vocabulary for a class in the timetable. No call site composes a
 *  time string — "16:30" is one function, and so is "Mondays, 16:30 to 17:00". */

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

/** Minutes from midnight → "16:30". Lives in lib/format with the other clock
 *  and date helpers; re-exported so class code keeps one import. */
export { formatTime };

/** "16:30" → 990. Returns null for anything that is not a 24-hour clock time. */
export function parseTime(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

type Slot = { dayOfWeek: DayOfWeek; startMinutes: number; durationMinutes: number };

/** "16:30 to 17:00": a class's own times. */
export function classTimes(slot: Pick<Slot, "startMinutes" | "durationMinutes">): string {
  return formatTimeRange(slot.startMinutes, slot.startMinutes + slot.durationMinutes);
}

/** "Mondays, 16:30 to 17:00": how someone plans around it. */
export function formatSlot(slot: Slot): string {
  return `${DAY_META[slot.dayOfWeek].label}s, ${classTimes(slot)}`;
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

/** Enrolment and history can name classes at either site. */
export function courseLabelWithSite(course: Parameters<typeof courseLabel>[0] & { club?: { name: string } }): string {
  return `${courseLabel(course)}${course.club ? ` · ${course.club.name}` : ""}`;
}

/** "12 of 16", or just the headcount when the class is uncapped. */
export function capacityLabel(taken: number, capacity: number | null): string {
  return capacity === null ? `${taken} enrolled` : `${taken} of ${capacity}`;
}

/** The capacity tag for a class, or null while it has room: "Full", or
 *  "2 over" in the over-capacity tone. */
export function capacityTone(taken: number, capacity: number | null): StatusMeta | null {
  if (capacity === null) return null;
  if (taken > capacity) return { ...CAPACITY_META.over, label: `${taken - capacity} over` };
  if (taken >= capacity) return CAPACITY_META.full;
  return null;
}

export function placesLeft(taken: number, capacity: number | null): number | null {
  return capacity === null ? null : Math.max(0, capacity - taken);
}
