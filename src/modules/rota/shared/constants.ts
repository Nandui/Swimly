import {
  ArrowRightLeft, CalendarDays, CircleCheck, CircleDashed, CircleEllipsis, Flower2, House, PartyPopper, Pencil, School, SlidersHorizontal, Thermometer,
  Timer, Users, WavesHorizontal,
} from "lucide-react";
import { addDaysIso } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

/** The rota's rules and words that are not about the timeline: absences and returns to work, the
 *  reasons a live day changes, bookings, breaks, and dates. Pure, so they are tested on their own
 *  (rota.test.ts). The timeline's statuses are in meta.ts. */

/** The first day on or after `fromIso` that falls on one of the weekdays (0 Monday … 6 Sunday),
 *  for a new booking's first and last day. */
export function nextWeekday(fromIso: string, weekdays: readonly number[]) {
  if (!weekdays.length) return fromIso;
  for (let d = fromIso, i = 0; i < 7; d = addDaysIso(d, 1), i++) {
    if (weekdays.includes((new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7)) return d;
  }
  return fromIso;
}

/** Why someone is off. Only people who run the rota see the reason; the rota itself says just
 *  that they are off. Never record medical details, only the reason. */
export const ABSENCE_REASON_META = {
  sickness: { label: "Sickness", color: "orange", icon: Thermometer },
  family: { label: "Family emergency", color: "blue", icon: House },
  bereavement: { label: "Bereavement", color: "gray", icon: Flower2 },
  other: { label: "Other", color: "gray", icon: CircleEllipsis },
} as const satisfies Record<string, StatusMeta>;
export type AbsenceReason = keyof typeof ABSENCE_REASON_META;
export const ABSENCE_REASONS = Object.keys(ABSENCE_REASON_META) as AbsenceReason[];

/** How soon after coming back a new absence is worth asking about: "is this
 *  the same thing again?" Four weeks, the usual window for linked sickness. */
const ABSENCE_AGAIN_DAYS = 28;

type EarlierAbsence = { id: string; firstDay: string; lastDay: string | null };
/** What a new report for this person, starting on `firstDay`, might be:
 *  - `extend`: they are still off (open-ended, or their last day off is on or
 *    after the day before), so this is most likely the same absence running on.
 *    `overlaps` when the new days are already covered: only extending makes sense.
 *  - `again`: they came back within ABSENCE_AGAIN_DAYS; it may be the same
 *    thing again, which the manager decides.
 *  - null: nothing recent. Pass the person's absences, any order. */
export function followOn<T extends EarlierAbsence>(earlier: readonly T[], firstDay: string):
  | { kind: "extend"; absence: T; overlaps: boolean }
  | { kind: "again"; absence: T; daysBack: number }
  | null {
  const started = earlier.filter((a) => a.firstDay <= firstDay).sort((a, b) => b.firstDay.localeCompare(a.firstDay));
  const latest = started[0];
  if (!latest) return null;
  const dayBefore = addDaysIso(firstDay, -1);
  if (!latest.lastDay || latest.lastDay >= dayBefore) return { kind: "extend", absence: latest, overlaps: !latest.lastDay || latest.lastDay >= firstDay };
  const daysBack = Math.round((Date.parse(`${firstDay}T00:00:00Z`) - Date.parse(`${latest.lastDay}T00:00:00Z`)) / 86_400_000) - 1;
  return daysBack <= ABSENCE_AGAIN_DAYS ? { kind: "again", absence: latest, daysBack } : null;
}

/** Why a day that had come (today or earlier) changed: kept in the day's log with its
 *  "Update Timepoint" follow-up. Covering is chosen when the person taken off is off that day. */
export const ROTA_CHANGE_REASON_META = {
  cover: { label: "Covering an absence", color: "blue", icon: Users },
  fill: { label: "Filling a gap in the plan", color: "blue", icon: CircleDashed },
  swap: { label: "Swap agreed between staff", color: "gray", icon: ArrowRightLeft },
  extra: { label: "Extra hours approved", color: "orange", icon: Timer },
  correction: { label: "Correcting a mistake in the plan", color: "gray", icon: Pencil },
} as const satisfies Record<string, StatusMeta>;
export type RotaChangeReason = keyof typeof ROTA_CHANGE_REASON_META;
export const ROTA_CHANGE_REASONS = Object.keys(ROTA_CHANGE_REASON_META) as RotaChangeReason[];

/** What a repeating booking is. */
export const BOOKING_KIND_META = {
  school: { label: "School lessons", color: "purple", icon: School },
  party: { label: "Party", color: "orange", icon: PartyPopper },
  lanes: { label: "Lane hire", color: "gray", icon: WavesHorizontal },
  event: { label: "Event", color: "green", icon: CalendarDays },
  other: { label: "Other", color: "gray", icon: CircleEllipsis },
} as const satisfies Record<string, StatusMeta>;
export type BookingKind = keyof typeof BOOKING_KIND_META;
export const BOOKING_KINDS = Object.keys(BOOKING_KIND_META) as BookingKind[];

/** Each date from `firstDay` to `lastDay` on one of `weekdays` (Monday = 0), less the days it
 *  does not run (a bank holiday, a school's mid-term). */
export function bookingDates(firstDay: string, lastDay: string, weekdays: readonly number[], skip: readonly string[] = []) {
  const out: string[] = [];
  for (let d = firstDay; d <= lastDay && out.length <= 400; d = addDaysIso(d, 1)) {
    const weekday = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
    if (weekdays.includes(weekday) && !skip.includes(d)) out.push(d);
  }
  return out;
}

/** The return-to-work conversation's answer: back as before, or back with
 *  changes to their work for a while. Tones come from here. */
export const RETURN_FIT_META = {
  fit: { label: "Fit to work", color: "green", icon: CircleCheck },
  adjusted: { label: "Back with changes", color: "blue", icon: SlidersHorizontal },
} as const satisfies Record<string, StatusMeta>;
export type ReturnFit = keyof typeof RETURN_FIT_META;
export const RETURN_FITS = Object.keys(RETURN_FIT_META) as ReturnFit[];

/** Sickness over seven days needs a fit note from a doctor; up to seven, the
 *  person self-certifies. The return to work asks about it only then. */
export const SELF_CERTIFIED_DAYS = 7;

/** Calendar days from the first day off to the last, both counted. */
export function daysOff(firstDay: string, lastDay: string) {
  return Math.round((Date.parse(`${lastDay}T00:00:00Z`) - Date.parse(`${firstDay}T00:00:00Z`)) / 86_400_000) + 1;
}

export function needsFitNote(a: { reason: string; firstDay: string; lastDay: string }) {
  return a.reason === "sickness" && daysOff(a.firstDay, a.lastDay) > SELF_CERTIFIED_DAYS;
}

/** Where an ended absence's return to work stands: recorded; due, because their first day of
 *  work back has come (or they have nothing on the rota, so it is due from the day after their
 *  last day off); or waiting for that day. `firstShift` is the date of their first day back. */
export function returnStage(a: { lastDay: string; returnMetOn: string | null }, firstShift: string | null, today: string): "recorded" | "due" | "waiting" {
  if (a.returnMetOn) return "recorded";
  return (firstShift ?? addDaysIso(a.lastDay, 1)) <= today ? "due" : "waiting";
}

/** What happened to an absence, for its story on the Absences page. */
export type AbsenceUpdateKind = "reported" | "extended" | "back";

/** The house rule for breaks (Employee Policies and Procedures Handbook
 *  2026, rest periods; owner, 3 October 2026), by shift length:
 *  over 4 and under 6 hours, one 15-minute unpaid; 6 to under 8, 30 unpaid
 *  and 15 paid; 8 to 10, 30 unpaid and two 15 paid; over 10, 45 unpaid and
 *  two 15 paid. */
export function breakEntitlement(shiftMinutes: number, young: YoungBand | null = null): { minutes: number; paid: boolean }[] {
  const h = shiftMinutes / 60;
  const list = h <= 4 ? []
    : h < 6 ? [{ minutes: 15, paid: false }]
    : h < 8 ? [{ minutes: 15, paid: true }, { minutes: 30, paid: false }]
    : h <= 10 ? [{ minutes: 15, paid: true }, { minutes: 30, paid: false }, { minutes: 15, paid: true }]
    : [{ minutes: 15, paid: true }, { minutes: 45, paid: false }, { minutes: 15, paid: true }];
  // Under 18 (handbook, Protection of Young Persons (Employment) Act 1996): at least
  // 30 minutes unpaid after 4.5 hours (16 and 17) or 4 hours (under 16), the standard
  // breaks extended to meet it.
  if (young && shiftMinutes > (young === "under16" ? 240 : 270)) {
    const unpaid = list.find((b) => !b.paid);
    if (!unpaid) return [...list, { minutes: 30, paid: false }];
    if (unpaid.minutes < 30) unpaid.minutes = 30;
  }
  return list;
}

/** Under-18s' band on a day, from a date of birth: under 16, or 16 and 17. */
export type YoungBand = "under16" | "under18";
export function youngBand(dateOfBirth: string | null, onIso: string): YoungBand | null {
  if (!dateOfBirth) return null;
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = onIso.split("-").map(Number);
  const age = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  return age < 16 ? "under16" : age < 18 ? "under18" : null;
}

/** Under-18s' rest (handbook: 12 hours off between shifts for 16 and 17, 14 under 16, and
 *  two days off a week). Warnings only (owner decision, 8 October 2026): the plan says so and the
 *  manager decides. `days` maps each date the person works, any site, to their first start and
 *  last finish; `date` is the day being planned. */
const YOUNG_REST_HOURS: Record<YoungBand, number> = { under16: 14, under18: 12 };
export function youngRest(band: YoungBand | null, date: string, days: ReadonlyMap<string, { start: number; end: number }>): string[] {
  const today = days.get(date);
  if (!band || !today) return [];
  const need = YOUNG_REST_HOURS[band] * 60;
  const out: string[] = [];
  const before = days.get(addDaysIso(date, -1)), after = days.get(addDaysIso(date, 1));
  if (before && 1440 - before.end + today.start < need) {
    out.push(`Finished at ${clock(before.end)} the day before: under-${band === "under16" ? "16s" : "18s"} need ${need / 60} hours off, so not before ${clock(before.end + need - 1440)}.`);
  }
  if (after && 1440 - today.end + after.start < need) {
    out.push(`Starts at ${clock(after.start)} the next day: ${need / 60} hours off means finishing by ${clock(after.start + 1440 - need)}.`);
  }
  const monday = mondayOf(date);
  const worked = Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i)).filter((d) => days.has(d)).length;
  if (worked > 5) out.push(`On ${worked} days this week: under-18s need two days off.`);
  return out;
}

/** "60 minutes: 30 unpaid and two 15-minute paid breaks". */
export function describeEntitlement(shiftMinutes: number, young: YoungBand | null = null) {
  const list = breakEntitlement(shiftMinutes, young);
  if (!list.length) return young ? "No break for a shift this short." : "No break for a shift of 4 hours or less.";
  const unpaid = list.filter((b) => !b.paid).reduce((m, b) => m + b.minutes, 0);
  const paid = list.filter((b) => b.paid);
  const total = list.reduce((m, b) => m + b.minutes, 0);
  return `${total} minutes: ${unpaid} unpaid${paid.length ? ` and ${paid.length === 1 ? "one" : "two"} 15-minute paid ${paid.length === 1 ? "break" : "breaks"}` : ""}${young ? ", under-18 minimum included" : ""}.`;
}

export const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** `HH:MM` → minutes past midnight, or null. */
export function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes <= 1440 ? minutes : null;
}

export function clock(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** The Monday of the week containing an ISO date. */
export function mondayOf(iso: string) {
  const date = new Date(`${iso}T00:00:00Z`);
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date.toISOString().slice(0, 10);
}

export { addDaysIso };
