import type { StatusMeta } from "@/lib/status";

/** Rota warnings. The rota never blocks a booking (owner decision, September
 *  2026); it says what is wrong. Tones come from here, never a call site, and
 *  each has its own icon in `RotaWarningTag`. */
export const ROTA_WARNING_META = {
  absent: { label: "Absent", color: "red" },
  expired: { label: "Qualification expired", color: "red" },
  missing: { label: "Qualification not recorded", color: "orange" },
  overlap: { label: "Double-booked", color: "orange" },
  open: { label: "Unfilled", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
export type RotaWarning = keyof typeof ROTA_WARNING_META;

/** Why someone is off. Only rota managers see the reason; the rota itself
 *  says just "Absent". Tones come from here, each with its own icon in
 *  `AbsenceReasonTag`. Never record medical details, only the reason. */
export const ABSENCE_REASON_META = {
  sickness: { label: "Sickness", color: "orange" },
  family: { label: "Family emergency", color: "blue" },
  bereavement: { label: "Bereavement", color: "gray" },
  other: { label: "Other", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
export type AbsenceReason = keyof typeof ABSENCE_REASON_META;
export const ABSENCE_REASONS = Object.keys(ABSENCE_REASON_META) as AbsenceReason[];

type AbsenceLike = { userId: string; firstDay: Date; lastDay: Date | null };
const isoOf = (date: Date) => date.toISOString().slice(0, 10);

/** Is this person off on this day? An absence with no last day runs on. */
export function absentOn(absences: readonly AbsenceLike[], userId: string, iso: string) {
  return absences.some((a) => a.userId === userId && isoOf(a.firstDay) <= iso && (!a.lastDay || isoOf(a.lastDay) >= iso));
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

export function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

type Held = { typeId: string; issuedOn: Date; expiresOn: Date | null; revokedAt: Date | null };
type ShiftLike = { id: string; userId: string | null; date: Date; startMinutes: number; endMinutes: number; requiredTypeId: string | null };

/** What is wrong with a shift, given the assignee's qualifications, their
 *  other shifts that day and whether they are off. Pure, so the rules are
 *  tested on their own. */
export function shiftWarnings(shift: ShiftLike, held: readonly Held[], sameDay: readonly ShiftLike[], absences: readonly AbsenceLike[] = []): RotaWarning[] {
  if (!shift.userId) return ["open"];
  const warnings: RotaWarning[] = [];
  if (absentOn(absences, shift.userId, isoOf(shift.date))) warnings.push("absent");
  if (shift.requiredTypeId) {
    const on = shift.date.toISOString().slice(0, 10);
    const ofType = held.filter((q) => q.typeId === shift.requiredTypeId && !q.revokedAt && q.issuedOn.toISOString().slice(0, 10) <= on);
    if (ofType.length === 0) warnings.push("missing");
    else if (!ofType.some((q) => !q.expiresOn || q.expiresOn.toISOString().slice(0, 10) >= on)) warnings.push("expired");
  }
  if (sameDay.some((other) => other.id !== shift.id && other.userId === shift.userId && other.startMinutes < shift.endMinutes && shift.startMinutes < other.endMinutes)) {
    warnings.push("overlap");
  }
  return warnings;
}
