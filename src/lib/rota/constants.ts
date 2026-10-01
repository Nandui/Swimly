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

/** What a roster re-upload did to someone's day (Roster changes). */
export const ROSTER_CHANGE_META = {
  added: { label: "Added", color: "green" },
  changed: { label: "Changed", color: "blue" },
  removed: { label: "Removed", color: "red" },
} as const satisfies Record<string, StatusMeta>;

/** A roster day that is not a shift: full holiday (FHOP) or another code. */
export const ROSTER_LEAVE_META = {
  holiday: { label: "Full holiday (paid)", color: "blue" },
  leave: { label: "Leave", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
export const ABSENCE_REASONS = Object.keys(ABSENCE_REASON_META) as AbsenceReason[];

/** Someone on the rota: their account, their entry on the imported roster
 *  (everyone on it, login or not), or both. */
export type PersonRef = { userId: string | null; rotaPersonId?: string | null };
type AbsenceLike = PersonRef & { firstDay: Date; lastDay: Date | null };
const isoOf = (date: Date) => date.toISOString().slice(0, 10);

/** The same person, by roster entry or by account. */
export function samePerson(a: PersonRef, b: PersonRef) {
  return (!!a.rotaPersonId && a.rotaPersonId === b.rotaPersonId) || (!!a.userId && a.userId === b.userId);
}

/** Is this person off on this day? An absence with no last day runs on. */
export function absentOn(absences: readonly AbsenceLike[], who: string | PersonRef, iso: string) {
  const person = typeof who === "string" ? { userId: who } : who;
  return absences.some((a) => samePerson(a, person) && isoOf(a.firstDay) <= iso && (!a.lastDay || isoOf(a.lastDay) >= iso));
}

/** How soon after coming back a new absence is worth asking about: "is this
 *  the same thing again?" Four weeks, the usual window for linked sickness. */
export const ABSENCE_AGAIN_DAYS = 28;

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

/** Why a duty changed once its week had started (Timepoint already holds that
 *  week). Covering an absence is chosen for the manager when the person
 *  taken off is recorded as off that day. */
export const ROTA_CHANGE_REASON_META = {
  cover: { label: "Covering an absence", color: "blue" },
  swap: { label: "Swap agreed between staff", color: "gray" },
  extra: { label: "Extra hours approved", color: "orange" },
  correction: { label: "Correcting a mistake in the plan", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
export type RotaChangeReason = keyof typeof ROTA_CHANGE_REASON_META;
export const ROTA_CHANGE_REASONS = Object.keys(ROTA_CHANGE_REASON_META) as RotaChangeReason[];

/** A week has started from its Monday: from then on Timepoint holds it, so a
 *  change to one of its duties needs a reason and is logged. Before then the
 *  plan is a draft and changes freely (Copy last week included). */
export function weekStarted(dateIso: string, todayIso: string) {
  return mondayOf(dateIso) <= todayIso;
}

/** The return-to-work conversation's answer: back as before, or back with
 *  changes to their work for a while. Tones come from here. */
export const RETURN_FIT_META = {
  fit: { label: "Fit to work", color: "green" },
  adjusted: { label: "Back with changes", color: "blue" },
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

/** Where an ended absence's return to work stands: recorded; due, because
 *  their first shift back has come (or they have no shift on the rota, so
 *  it is due from the day after their last day off); or waiting for that
 *  shift. `firstShift` is the date of their first shift after the absence. */
export function returnStage(a: { lastDay: string; returnMetOn: string | null }, firstShift: string | null, today: string): "recorded" | "due" | "waiting" {
  if (a.returnMetOn) return "recorded";
  return (firstShift ?? addDaysIso(a.lastDay, 1)) <= today ? "due" : "waiting";
}

/** What happened to an absence, for its story on the Absences page. */
export const ABSENCE_UPDATE_KINDS = ["reported", "extended", "back"] as const;
export type AbsenceUpdateKind = (typeof ABSENCE_UPDATE_KINDS)[number];

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
type ShiftLike = PersonRef & { id: string; date: Date; startMinutes: number; endMinutes: number; requiredTypeId: string | null; kind?: string };

/** What is wrong with a shift, given the assignee's qualifications, their
 *  other shifts that day and whether they are off. A holiday or leave day from
 *  the roster is not a shift and has nothing wrong with it. Pure, so the rules
 *  are tested on their own. */
export function shiftWarnings(shift: ShiftLike, held: readonly Held[], sameDay: readonly ShiftLike[], absences: readonly AbsenceLike[] = []): RotaWarning[] {
  if (shift.kind && shift.kind !== "shift") return [];
  if (!shift.userId && !shift.rotaPersonId) return ["open"];
  const warnings: RotaWarning[] = [];
  if (absentOn(absences, shift, isoOf(shift.date))) warnings.push("absent");
  if (shift.requiredTypeId) {
    const on = shift.date.toISOString().slice(0, 10);
    const ofType = held.filter((q) => q.typeId === shift.requiredTypeId && !q.revokedAt && q.issuedOn.toISOString().slice(0, 10) <= on);
    if (ofType.length === 0) warnings.push("missing");
    else if (!ofType.some((q) => !q.expiresOn || q.expiresOn.toISOString().slice(0, 10) >= on)) warnings.push("expired");
  }
  if (sameDay.some((other) => other.id !== shift.id && (!other.kind || other.kind === "shift") && samePerson(other, shift) && other.startMinutes < shift.endMinutes && shift.startMinutes < other.endMinutes)) {
    warnings.push("overlap");
  }
  return warnings;
}
