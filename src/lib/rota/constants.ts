import {
  Activity, ArrowRightLeft, CalendarDays, CalendarOff, CircleCheck, CircleDashed, CircleEllipsis, CircleMinus, Coffee,
  CopyX, FileQuestion, Flower2, GraduationCap, House, PartyPopper, Pencil, Plus, School, SlidersHorizontal, Thermometer,
  Timer, TreePalm, TriangleAlert, Users, UserX, WavesHorizontal,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Rota warnings. The rota never blocks a booking (owner decision, September
 *  2026); it says what is wrong. Tone and icon come from here, never a call site. */
export const ROTA_WARNING_META = {
  absent: { label: "Absent", color: "red", icon: UserX },
  expired: { label: "Qualification expired", color: "red", icon: TriangleAlert },
  missing: { label: "Qualification not recorded", color: "orange", icon: FileQuestion },
  overlap: { label: "Double-booked", color: "orange", icon: CopyX },
  teaching: { label: "Teaching a swim class then", color: "orange", icon: GraduationCap },
  open: { label: "Unfilled", color: "gray", icon: CircleDashed },
} as const satisfies Record<string, StatusMeta>;
export type RotaWarning = keyof typeof ROTA_WARNING_META;

/** Why someone is off. Only rota managers see the reason; the rota itself
 *  says just "Absent". Never record medical details, only the reason. */
export const ABSENCE_REASON_META = {
  sickness: { label: "Sickness", color: "orange", icon: Thermometer },
  family: { label: "Family emergency", color: "blue", icon: House },
  bereavement: { label: "Bereavement", color: "gray", icon: Flower2 },
  other: { label: "Other", color: "gray", icon: CircleEllipsis },
} as const satisfies Record<string, StatusMeta>;
export type AbsenceReason = keyof typeof ABSENCE_REASON_META;

/** What a roster re-upload did to someone's day (Roster changes). */
export const ROSTER_CHANGE_META = {
  added: { label: "Added", color: "green", icon: Plus },
  changed: { label: "Changed", color: "blue", icon: Pencil },
  removed: { label: "Removed", color: "red", icon: CircleMinus },
} as const satisfies Record<string, StatusMeta>;

/** A roster day that is not a shift: full holiday (FHOP) or another code. */
export const ROSTER_LEAVE_META = {
  holiday: { label: "Full holiday (paid)", color: "blue", icon: TreePalm },
  leave: { label: "Leave", color: "gray", icon: CalendarOff },
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
  cover: { label: "Covering an absence", color: "blue", icon: Users },
  swap: { label: "Swap agreed between staff", color: "gray", icon: ArrowRightLeft },
  extra: { label: "Extra hours approved", color: "orange", icon: Timer },
  correction: { label: "Correcting a mistake in the plan", color: "gray", icon: Pencil },
} as const satisfies Record<string, StatusMeta>;
export type RotaChangeReason = keyof typeof ROTA_CHANGE_REASON_META;
export const ROTA_CHANGE_REASONS = Object.keys(ROTA_CHANGE_REASON_META) as RotaChangeReason[];

/** What a booking is. Its sessions show on the week plan under its name. */
export const BOOKING_KIND_META = {
  school: { label: "School lessons", color: "blue", icon: School },
  party: { label: "Party", color: "orange", icon: PartyPopper },
  lanes: { label: "Lane hire", color: "gray", icon: WavesHorizontal },
  event: { label: "Event", color: "green", icon: CalendarDays },
  other: { label: "Other", color: "gray", icon: CircleEllipsis },
} as const satisfies Record<string, StatusMeta>;
export type BookingKind = keyof typeof BOOKING_KIND_META;
export const BOOKING_KINDS = Object.keys(BOOKING_KIND_META) as BookingKind[];
/** The most places one booking may create, so a typo in a date cannot fill a year. */
export const BOOKING_MAX_PLACES = 600;

/** The duty name a booking's places carry: "School lessons: Example NS". */
export function bookingDuty(kind: string, title: string) {
  return `${BOOKING_KIND_META[kind as BookingKind]?.label ?? "Booking"}: ${title}`;
}

/** Each date from `firstDay` to `lastDay` on one of `weekdays` (Monday = 0). */
export function bookingDates(firstDay: string, lastDay: string, weekdays: readonly number[]) {
  const out: string[] = [];
  for (let d = firstDay; d <= lastDay && out.length <= 400; d = addDaysIso(d, 1)) {
    const weekday = (new Date(`${d}T00:00:00Z`).getUTCDay() + 6) % 7;
    if (weekdays.includes(weekday)) out.push(d);
  }
  return out;
}

/** A week has started from its Monday: from then on Timepoint holds it, so a
 *  change to one of its duties needs a reason and is logged. Before then the
 *  plan is a draft and changes freely (Copy last week included). */
export function weekStarted(dateIso: string, todayIso: string) {
  return mondayOf(dateIso) <= todayIso;
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

/** What a stretch of a shift is (owner request, October 2026: "assigning
 *  their activity during a shift and all the breaks"). Tones come from here. */
export const SEGMENT_KIND_META = {
  activity: { label: "Activity", color: "blue", icon: Activity },
  break: { label: "Break", color: "gray", icon: Coffee },
} as const satisfies Record<string, StatusMeta>;
export type SegmentKind = keyof typeof SEGMENT_KIND_META;
export const SEGMENT_KINDS = Object.keys(SEGMENT_KIND_META) as SegmentKind[];
/** Activities offered before a site has its own; the ones used there come first. */
export const ACTIVITY_SUGGESTIONS = ["25m pool lifeguard", "18m pool lifeguard", "Poolside", "Teaching", "Rookie", "Reception", "Plant room", "Cleaning", "Gym floor"];

export type SegmentLike = { startMinutes: number; endMinutes: number; kind: string; label: string };

/** Break names. A break named "Paid break" stays in the hours; any other
 *  break (unpaid, or an older plain "Break") comes off them. */
export const PAID_BREAK = "Paid break";
export const UNPAID_BREAK = "Unpaid break";
export function isPaidBreak(g: { kind: string; label: string }) {
  return g.kind === "break" && g.label.trim().toLowerCase() === PAID_BREAK.toLowerCase();
}

/** The house rule for breaks (Employee Policies and Procedures Handbook
 *  2026, rest periods; owner, 3 October 2026), by shift length:
 *  over 4 and under 6 hours, one 15-minute unpaid; 6 to under 8, 30 unpaid
 *  and 15 paid; 8 to 10, 30 unpaid and two 15 paid; over 10, 45 unpaid and
 *  two 15 paid. The manager on shift allocates them. */
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

/** "60 minutes: 30 unpaid and two 15-minute paid breaks", for the dialog. */
export function describeEntitlement(shiftMinutes: number, young: YoungBand | null = null) {
  const list = breakEntitlement(shiftMinutes, young);
  if (!list.length) return young ? "No break for a shift this short." : "No break for a shift of 4 hours or less.";
  const unpaid = list.filter((b) => !b.paid).reduce((m, b) => m + b.minutes, 0);
  const paid = list.filter((b) => b.paid);
  const total = list.reduce((m, b) => m + b.minutes, 0);
  return `${total} minutes: ${unpaid} unpaid${paid.length ? ` and ${paid.length === 1 ? "one" : "two"} 15-minute paid ${paid.length === 1 ? "break" : "breaks"}` : ""}${young ? ", under-18 minimum included" : ""}.`;
}

/** The shift's plan with its breaks suggested by the house rule, replacing
 *  any breaks it had. The unpaid break goes near the middle, paid ones before
 *  and after, each on a quarter hour in time with nothing planned, so a break
 *  never takes someone off an activity; only when the shift is planned full
 *  does a break cut into an activity (and that stretch shows as a gap). */
export function suggestBreaks(shift: { startMinutes: number; endMinutes: number }, segments: readonly SegmentLike[], young: YoungBand | null = null): SegmentLike[] {
  const length = shift.endMinutes - shift.startMinutes;
  const wanted = breakEntitlement(length, young);
  let plan: SegmentLike[] = segments.filter((g) => g.kind !== "break").map((g) => ({ ...g }));
  const fractions = wanted.length === 1 ? [0.5] : wanted.length === 2 ? [0.35, 0.6] : [0.25, 0.5, 0.75];
  const free = (start: number, end: number) => start >= shift.startMinutes && end <= shift.endMinutes && !plan.some((g) => g.startMinutes < end && start < g.endMinutes);
  wanted.forEach((b, i) => {
    const target = Math.round((shift.startMinutes + length * fractions[i] - b.minutes / 2) / 15) * 15;
    let start: number | null = null;
    for (let step = 0; step * 15 <= length && start === null; step++) {
      for (const at of [target + step * 15, target - step * 15]) if (start === null && free(at, at + b.minutes)) start = at;
    }
    const at = start ?? Math.min(Math.max(target, shift.startMinutes), shift.endMinutes - b.minutes);
    const end = at + b.minutes;
    if (start === null) {
      // Planned full: cut the break out of whatever it lands on.
      plan = plan.flatMap((g) => g.startMinutes < end && at < g.endMinutes
        ? [...(g.startMinutes < at ? [{ ...g, endMinutes: at }] : []), ...(g.endMinutes > end ? [{ ...g, startMinutes: end }] : [])]
        : [g]);
    }
    plan.push({ startMinutes: at, endMinutes: end, kind: "break", label: b.paid ? PAID_BREAK : UNPAID_BREAK });
  });
  return plan.sort((a, b) => a.startMinutes - b.startMinutes);
}
/** What is wrong with a shift's segments, or null: each inside the shift, none
 *  overlapping, each with a name. Pure; the action and the dialog both use it. */
export function segmentProblem(shift: { startMinutes: number; endMinutes: number }, segments: readonly SegmentLike[]): string | null {
  const sorted = [...segments].sort((a, b) => a.startMinutes - b.startMinutes);
  for (const [i, s] of sorted.entries()) {
    if (s.endMinutes <= s.startMinutes) return `${s.label || "A segment"} has to end after it starts.`;
    if (s.startMinutes < shift.startMinutes || s.endMinutes > shift.endMinutes) return `${s.label || "A segment"} has to be inside the shift, ${clock(shift.startMinutes)}–${clock(shift.endMinutes)}.`;
    if (s.kind === "activity" && s.label.trim().length < 2) return "Say what each activity is, for example 25m pool lifeguard.";
    if (i && sorted[i - 1].endMinutes > s.startMinutes) return `${sorted[i - 1].label} and ${s.label} overlap. One thing at a time.`;
  }
  return null;
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
type ShiftLike = PersonRef & { id: string; date: Date; startMinutes: number; endMinutes: number; requiredTypeId: string | null; kind?: string };

/** What is wrong with a shift, given the assignee's qualifications, their
 *  other shifts that day and whether they are off. A holiday or leave day from
 *  the roster is not a shift and has nothing wrong with it. Pure, so the rules
 *  are tested on their own. */
export function shiftWarnings(shift: ShiftLike, held: readonly Held[], sameDay: readonly ShiftLike[], absences: readonly AbsenceLike[] = [],
  /** What else the person is committed to that day (swim classes they teach). */
  elsewhere: readonly { userId: string | null; startMinutes: number; endMinutes: number }[] = []): RotaWarning[] {
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
  if (shift.userId && elsewhere.some((c) => c.userId === shift.userId && c.startMinutes < shift.endMinutes && shift.startMinutes < c.endMinutes)) warnings.push("teaching");
  return warnings;
}
