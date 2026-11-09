import {
  AlertTriangle, BadgeCheck, Ban, CalendarClock, CheckCircle2, CircleDashed, Clock, FileWarning, GraduationCap, Hourglass, LifeBuoy,
  MessageCircle, PhoneCall, PhoneOff, Repeat, Scale, ShieldAlert, Timer, UserRound, UserX, Users, XCircle,
} from "lucide-react";
import { z } from "zod";
import { addDaysIso, ageOn, dublinInstant, parseDateOnly, toDateOnlyString } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

/** Staffing's rules, pure and client-safe (docs/staffing.md): the settings and their defaults, the
 *  status maps, semesters, block dates, call-off deadlines, the strike ladder, exam absence
 *  outcomes, swaps, acknowledgements and the warnings a person can carry on a shift.
 *
 *  Warnings, never blocks (owner's choice, 4 November 2026). Every rule here answers a question;
 *  the screens show the answer and the supervisor decides. Rule ids (BR-…) are the spec's. */

/* ---------- Settings ---------- */

/** Minutes past midnight, from "HH:MM". */
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:30.");
const hours = (max: number) => z.coerce.number().int().min(0).max(max);

export const settingsSchema = z.object({
  publishTime: clock.default("17:00"),
  startOffsetWeeks: hours(12).default(4),
  minNoticeHours: hours(168).default(24),
  ackHours: hours(168).default(48),
  ackReminderHours: hours(168).default(24),
  swapNoticeHours: hours(336).default(48),
  swapApprovalHours: hours(168).default(24),
  maxGiveaways: hours(14).default(2),
  /** A shift starting at or after this is a late shift for call-offs (open question 2: assumed noon). */
  lateShiftFrom: clock.default("12:00"),
  lateShiftCallBy: clock.default("09:30"),
  earlyShiftCallBy: clock.default("18:00"),
  callMinimumHours: hours(24).default(1),
  lateArrivalMinutes: hours(600).default(60),
  restHours: hours(24).default(11),
  weeklyCapHours: hours(80).default(39),
  examDeadlineDays: hours(90).default(21),
  clashFlag: hours(10).default(3),
  strikeCountingFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.").default("2027-01-25"),
  strikeDueDays: hours(60).default(7),
  /** The qualification types each role needs, from Admin's list. Null checks nothing. */
  teachingTypeId: z.string().nullable().default(null),
  lifeguardTypeId: z.string().nullable().default(null),
  vettingTypeId: z.string().nullable().default(null),
});
export type StaffingSettings = z.output<typeof settingsSchema>;
export const STAFFING_DEFAULTS: StaffingSettings = settingsSchema.parse({});

/** Stored values over the defaults; anything unreadable falls back to its default. */
export function readSettings(stored: unknown): StaffingSettings {
  const values = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const out: Record<string, unknown> = { ...STAFFING_DEFAULTS };
  for (const [key, field] of Object.entries(settingsSchema.shape)) {
    if (!(key in values)) continue;
    const parsed = (field as z.ZodTypeAny).safeParse(values[key]);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as StaffingSettings;
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/* ---------- Status maps ---------- */

export const SLOT_ROLES = ["teaching", "lifeguard", "float"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];
export const SLOT_ROLE_META = {
  teaching: { label: "Teaching", color: "blue", icon: GraduationCap },
  lifeguard: { label: "Lifeguard", color: "purple", icon: LifeBuoy },
  float: { label: "Float", color: "gray", icon: Users },
} satisfies Record<SlotRole, StatusMeta>;

export const COLLEGES = ["ucc", "mtu", "none"] as const;
export type College = (typeof COLLEGES)[number];
export const COLLEGE_META = {
  ucc: { label: "UCC", color: "blue", icon: GraduationCap },
  mtu: { label: "MTU", color: "purple", icon: GraduationCap },
  none: { label: "No college", color: "gray", icon: UserRound },
} satisfies Record<College, StatusMeta>;

/** The part-time pool contracts (owner, 9 November 2026: lifeguards are rostered here too). */
export const CONTRACT_KINDS = ["swim_teacher", "lifeguard", "swim_teacher_lifeguard"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];
export const CONTRACT_KIND_META = {
  swim_teacher: { label: "Swim teacher", color: "blue", icon: GraduationCap },
  lifeguard: { label: "Lifeguard", color: "purple", icon: LifeBuoy },
  swim_teacher_lifeguard: { label: "Swim teacher and lifeguard", color: "gray", icon: Users },
} satisfies Record<ContractKind, StatusMeta>;

/** Whether a contract covers a slot's role. A float is anyone's. */
export function contractCovers(contract: ContractKind, role: string): boolean {
  if (role === "lifeguard") return contract !== "swim_teacher";
  if (role === "teaching") return contract !== "lifeguard";
  return true;
}

export const SEASON_NAMES = ["winter", "spring", "summer"] as const;
export type SeasonName = (typeof SEASON_NAMES)[number];
export const SEASON_LABEL: Record<SeasonName, string> = { winter: "Winter", spring: "Spring", summer: "Summer" };

export const SHIFT_STATUSES = ["scheduled", "absent_approved", "called_off", "late", "sent_home", "no_show"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];
export const SHIFT_STATUS_META = {
  scheduled: { label: "On", color: "blue", icon: CheckCircle2 },
  absent_approved: { label: "Approved absence", color: "gray", icon: CalendarClock },
  called_off: { label: "Called off", color: "orange", icon: PhoneOff },
  late: { label: "Late", color: "orange", icon: Clock },
  sent_home: { label: "Sent home", color: "red", icon: Ban },
  no_show: { label: "No call, no show", color: "red", icon: UserX },
} satisfies Record<ShiftStatus, StatusMeta>;
/** A shift whose person is not there: its place needs cover. */
export const isAway = (status: string) => status !== "scheduled" && status !== "late";

export const BLOCK_STATES = ["draft", "overdue", "published"] as const;
export type BlockState = (typeof BLOCK_STATES)[number];
export const BLOCK_STATE_META = {
  draft: { label: "Draft", color: "orange", icon: CircleDashed },
  overdue: { label: "Publish overdue", color: "red", icon: AlertTriangle },
  published: { label: "Published", color: "green", icon: BadgeCheck },
} satisfies Record<BlockState, StatusMeta>;

export const HOURS_META = {
  short: { label: "Below contract", color: "orange", icon: Scale },
  met: { label: "Contract met", color: "green", icon: CheckCircle2 },
} satisfies Record<"short" | "met", StatusMeta>;

export const ACK_STATES = ["acknowledged", "waiting", "remind", "phone"] as const;
export type AckState = (typeof ACK_STATES)[number];
export const ACK_STATE_META = {
  acknowledged: { label: "Acknowledged", color: "green", icon: CheckCircle2 },
  waiting: { label: "Waiting", color: "gray", icon: Hourglass },
  remind: { label: "Reminder due", color: "orange", icon: MessageCircle },
  phone: { label: "Phone them", color: "red", icon: PhoneCall },
} satisfies Record<AckState, StatusMeta>;

export const SWAP_STATUSES = ["open", "accepted", "approved", "refused", "expired"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];
export const SWAP_STATUS_META = {
  open: { label: "Looking for cover", color: "orange", icon: Repeat },
  accepted: { label: "To approve", color: "blue", icon: Hourglass },
  approved: { label: "Approved", color: "green", icon: CheckCircle2 },
  refused: { label: "Refused", color: "gray", icon: XCircle },
  expired: { label: "Expired", color: "gray", icon: Timer },
} satisfies Record<SwapStatus, StatusMeta>;

/** Flags on a request that a supervisor or manager should notice. */
export const REQUEST_FLAG_META = {
  overdue: { label: "Waiting over 24 hours", color: "red", icon: Timer },
  overLimit: { label: "Over the giveaway limit", color: "orange", icon: Repeat },
  thirdClash: { label: "Third short-notice clash", color: "red", icon: AlertTriangle },
} satisfies Record<"overdue" | "overLimit" | "thirdClash", StatusMeta>;

export const ATTENDANCE_KINDS = ["call_off", "late", "no_show"] as const;
export type AttendanceKind = (typeof ATTENDANCE_KINDS)[number];
export const ATTENDANCE_META = {
  call_off: { label: "Call-off", color: "orange", icon: PhoneOff },
  late: { label: "Late arrival", color: "orange", icon: Clock },
  no_show: { label: "No call, no show", color: "red", icon: UserX },
} satisfies Record<AttendanceKind, StatusMeta>;
export const CALL_METHODS = ["phone", "text", "other"] as const;
export type CallMethod = (typeof CALL_METHODS)[number];
export const CALL_METHOD_LABEL: Record<CallMethod, string> = { phone: "Phoned the centre landline", text: "Text, WhatsApp or Google Chat", other: "Something else" };

export const STRIKE_CAUSES = ["late_call_off", "short_notice", "late_arrival", "no_show", "exam_late_notice", "exam_short_notice", "exam_no_notice", "swap_no_show"] as const;
export type StrikeCause = (typeof STRIKE_CAUSES)[number];
export const STRIKE_CAUSE_META = {
  late_call_off: { label: "Called off late", color: "orange", icon: PhoneOff },
  short_notice: { label: "Short-notice absence, not sickness", color: "orange", icon: CalendarClock },
  late_arrival: { label: "Over an hour late without calling", color: "orange", icon: Clock },
  no_show: { label: "No call, no show", color: "red", icon: UserX },
  exam_late_notice: { label: "Exam absence after the deadline", color: "orange", icon: FileWarning },
  exam_short_notice: { label: "Exam absence under 48 hours", color: "orange", icon: Hourglass },
  exam_no_notice: { label: "Exam absence without the college's notice", color: "red", icon: ShieldAlert },
  swap_no_show: { label: "Did not work a shift taken in a swap", color: "red", icon: Repeat },
} satisfies Record<StrikeCause, StatusMeta>;

export const STRIKE_STAGES = ["not_counted", "informal_1", "informal_2", "formal_referral", "serious_misconduct_referral"] as const;
export type StrikeStage = (typeof STRIKE_STAGES)[number];
export const STRIKE_STAGE_META = {
  not_counted: { label: "Settling in, not counted", color: "gray", icon: CircleDashed },
  informal_1: { label: "Return-to-work chat", color: "blue", icon: MessageCircle },
  informal_2: { label: "Second informal, signed note", color: "orange", icon: MessageCircle },
  formal_referral: { label: "Formal referral to HR", color: "red", icon: Scale },
  serious_misconduct_referral: { label: "Serious misconduct referral", color: "red", icon: ShieldAlert },
} satisfies Record<StrikeStage, StatusMeta>;
/** Who owns each stage's next step (BR-8.3). */
export const STRIKE_OWNER: Record<StrikeStage, string> = {
  not_counted: "Nobody: logged only",
  informal_1: "Duty manager, on their next shift",
  informal_2: "Pool deck supervisor",
  formal_referral: "Centre manager and HR",
  serious_misconduct_referral: "Centre manager and HR, now",
};

export const EXAM_OUTCOMES = ["on_time", "college_short_notice", "late_notice", "short_notice", "no_notice"] as const;
export type ExamOutcome = (typeof EXAM_OUTCOMES)[number];
export const EXAM_OUTCOME_META = {
  on_time: { label: "On time: unpaid, no strike", color: "green", icon: CheckCircle2 },
  college_short_notice: { label: "College's short notice: unpaid, no strike", color: "green", icon: CalendarClock },
  late_notice: { label: "After the deadline: unpaid, strike", color: "orange", icon: FileWarning },
  short_notice: { label: "Under 48 hours: unpaid, strike", color: "red", icon: FileWarning },
  no_notice: { label: "No college notice: refused, referral", color: "red", icon: ShieldAlert },
} satisfies Record<ExamOutcome, StatusMeta>;

export const FIT_KINDS = ["contract", "qualification", "vetting", "overlap", "rest", "weekly", "young"] as const;
export type FitKind = (typeof FIT_KINDS)[number];
export const FIT_META = {
  contract: { label: "Not on their contract", color: "red", icon: LifeBuoy },
  qualification: { label: "Qualification not current", color: "red", icon: BadgeCheck },
  vetting: { label: "Garda vetting not current", color: "red", icon: ShieldAlert },
  overlap: { label: "Already on then", color: "red", icon: Users },
  rest: { label: "Short rest", color: "orange", icon: Timer },
  weekly: { label: "Over the weekly cap", color: "orange", icon: Scale },
  young: { label: "Under 18", color: "orange", icon: UserRound },
} satisfies Record<FitKind, StatusMeta>;

/* ---------- Dates ---------- */

const HOUR = 3_600_000;

/** 1 Monday to 7 Sunday, of a `YYYY-MM-DD`. */
export function isoWeekday(iso: string): number {
  const d = parseDateOnly(iso).getUTCDay();
  return d === 0 ? 7 : d;
}
export const mondayOf = (iso: string) => addDaysIso(iso, 1 - isoWeekday(iso));
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** The semester a day counts in (BR-8.1): strikes reset in September, January and May. */
export function semesterOf(iso: string): { key: string; label: string; startsOn: string } {
  const year = Number(iso.slice(0, 4)), month = Number(iso.slice(5, 7));
  const start = month >= 9 ? 9 : month >= 5 ? 5 : 1;
  const key = `${year}-${String(start).padStart(2, "0")}`;
  const label = start === 9 ? `Sep to Dec ${year}` : start === 5 ? `May to Aug ${year}` : `Jan to Apr ${year}`;
  return { key, label, startsOn: `${key}-01` };
}

/** The semester before a semester's key. */
export function previousSemester(key: string): string {
  const year = Number(key.slice(0, 4)), start = key.slice(5);
  return start === "01" ? `${year - 1}-09` : start === "05" ? `${year}-01` : `${year}-05`;
}

/** A block's fourteen days. */
export const blockDays = (startsOn: string) => Array.from({ length: 14 }, (_, i) => addDaysIso(startsOn, i));
export const blockEnd = (startsOn: string) => addDaysIso(startsOn, 13);

/** When a block must be published (BR-2.2): the Friday, at the publish time, the offset in weeks
 *  before the Monday it starts (Friday plus three days is the Monday). */
export function publishDeadline(startsOn: string, s: Pick<StaffingSettings, "publishTime" | "startOffsetWeeks">): Date {
  const friday = addDaysIso(startsOn, -(s.startOffsetWeeks * 7 + 3));
  return dublinInstant(friday, toMinutes(s.publishTime)) ?? parseDateOnly(friday);
}

export function blockState(publishedAt: Date | null, deadline: Date, now: Date): BlockState {
  if (publishedAt) return "published";
  return now.getTime() > deadline.getTime() ? "overdue" : "draft";
}

/** The Monday a new block should start on: the day after the last block, else the first Monday
 *  whose deadline has not passed. */
export function nextBlockStart(lastStartsOn: string | null, todayIso: string, s: Pick<StaffingSettings, "publishTime" | "startOffsetWeeks">, now: Date): string {
  if (lastStartsOn) return addDaysIso(lastStartsOn, 14);
  let monday = addDaysIso(mondayOf(todayIso), 7);
  while (publishDeadline(monday, s).getTime() < now.getTime()) monday = addDaysIso(monday, 7);
  return monday;
}

/** The instant a shift starts. */
export const shiftStart = (shift: { date: string; startMin: number }) =>
  dublinInstant(shift.date, Math.min(Math.max(shift.startMin, 0), 1439)) ?? parseDateOnly(shift.date);
export const shiftEnd = (shift: { date: string; endMin: number }) =>
  dublinInstant(shift.date, Math.min(Math.max(shift.endMin, 0), 1439)) ?? parseDateOnly(shift.date);
export const hoursUntil = (start: Date, now: Date) => (start.getTime() - now.getTime()) / HOUR;

/* ---------- Call-offs (BR-6.2, 6.3, 6.6, 6.7, 6.8) ---------- */

export type CallOffJudgement = { onTime: boolean; deadline: Date; why: string };

/** Whether a call-off was in time. Only a phone call to the landline counts. A late shift's call is
 *  due by the morning deadline that day; an early shift's by the evening deadline the day before.
 *  In exceptional circumstances (the duty manager's judgement) a call at least the minimum before
 *  the shift is in time. */
export function judgeCallOff(shift: { date: string; startMin: number }, calledAt: Date, method: CallMethod, exceptional: boolean, s: StaffingSettings): CallOffJudgement {
  const late = shift.startMin >= toMinutes(s.lateShiftFrom);
  const deadline = late
    ? dublinInstant(shift.date, toMinutes(s.lateShiftCallBy)) ?? shiftStart(shift)
    : dublinInstant(addDaysIso(shift.date, -1), toMinutes(s.earlyShiftCallBy)) ?? shiftStart(shift);
  if (method !== "phone") return { onTime: false, deadline, why: "Only a phone call to the centre landline counts." };
  if (calledAt.getTime() <= deadline.getTime()) return { onTime: true, deadline, why: late ? "Called before the late shift's deadline." : "Called before the early shift's deadline." };
  if (exceptional && hoursUntil(shiftStart(shift), calledAt) >= s.callMinimumHours) {
    return { onTime: true, deadline, why: `Exceptional circumstances, called at least ${s.callMinimumHours} hour${s.callMinimumHours === 1 ? "" : "s"} before.` };
  }
  return { onTime: false, deadline, why: late ? "Called after the late shift's deadline." : "Called after the early shift's deadline." };
}

/** The strike an attendance entry brings, if any (BR-6.4, 6.6, 6.7, 6.8). */
export function attendanceStrike(entry: { kind: AttendanceKind; reason?: "sick" | "other" | null; onTime?: boolean | null; minutesLate?: number | null; swapTaken?: boolean }, s: StaffingSettings): StrikeCause | null {
  if (entry.kind === "no_show") return entry.swapTaken ? "swap_no_show" : "no_show";
  if (entry.kind === "late") return (entry.minutesLate ?? 0) > s.lateArrivalMinutes ? "late_arrival" : null;
  if (!entry.onTime) return "late_call_off";
  return entry.reason === "sick" ? null : "short_notice";
}

/* ---------- Strikes (BR-8) ---------- */

export const strikeCounted = (occurredOn: string, s: Pick<StaffingSettings, "strikeCountingFrom">) => occurredOn >= s.strikeCountingFrom;

/** The stage a strike starts at: its number on the ladder, a no-show straight to referral. */
export function strikeStage(number: number, cause: StrikeCause, counted: boolean): StrikeStage {
  if (cause === "no_show" || cause === "swap_no_show" || cause === "exam_no_notice") return "serious_misconduct_referral";
  if (!counted) return "not_counted";
  return number <= 1 ? "informal_1" : number === 2 ? "informal_2" : "formal_referral";
}

/** When the owner's step is due (BR-8.4): strike 1 by the person's next shift, the rest within
 *  the set days. A referral for a no-show is due today. */
export function strikeDue(stage: StrikeStage, occurredOn: string, nextShift: string | null, s: Pick<StaffingSettings, "strikeDueDays">): string {
  if (stage === "serious_misconduct_referral") return occurredOn;
  if (stage === "informal_1") return nextShift ?? addDaysIso(occurredOn, s.strikeDueDays);
  return addDaysIso(occurredOn, s.strikeDueDays);
}

/* ---------- Exams (BR-7) ---------- */

export const examDeadline = (startsOn: string, s: Pick<StaffingSettings, "examDeadlineDays">) => addDaysIso(startsOn, -s.examDeadlineDays);

/** The outcome of an exam absence (BR-7.4). The deadline is the season's; without a season on
 *  record there is none, and only the 48 hours count. */
export function examOutcome(input: { requestedAt: Date; shift: { date: string; startMin: number }; seasonStartsOn: string | null; noticeSentOn: string | null; requestedOn: string }, s: StaffingSettings): ExamOutcome {
  if (!input.noticeSentOn) return "no_notice";
  const deadline = input.seasonStartsOn ? examDeadline(input.seasonStartsOn, s) : null;
  if (deadline && input.noticeSentOn > deadline) return "college_short_notice";
  if (!deadline || input.requestedOn <= deadline) {
    if (!deadline && hoursUntil(shiftStart(input.shift), input.requestedAt) < s.swapNoticeHours) return "short_notice";
    return "on_time";
  }
  return hoursUntil(shiftStart(input.shift), input.requestedAt) >= s.swapNoticeHours ? "late_notice" : "short_notice";
}
export const examApproved = (o: ExamOutcome) => o !== "no_notice";
export const examStrike = (o: ExamOutcome): StrikeCause | null =>
  o === "late_notice" ? "exam_late_notice" : o === "short_notice" ? "exam_short_notice" : o === "no_notice" ? "exam_no_notice" : null;
/** Short-notice college clashes count towards the centre manager's flag (BR-7.6). */
export const isShortNoticeClash = (o: string) => o === "late_notice" || o === "short_notice" || o === "college_short_notice";

/** The season a day falls in for a college, if any. */
export function seasonFor<T extends { college: string; startsOn: string; endsOn: string }>(seasons: readonly T[], college: string, day: string): T | null {
  return seasons.find((x) => x.college === college && x.startsOn <= day && day <= x.endsOn) ?? null;
}

/* ---------- Swaps (BR-5) ---------- */

/** A swap can be asked for until the notice before the shift; after that, phone the duty manager. */
export const swapAllowed = (start: Date, now: Date, s: Pick<StaffingSettings, "swapNoticeHours">) => hoursUntil(start, now) >= s.swapNoticeHours;
/** An open request nobody took expires at the notice before the shift and the shift stays put. */
export const swapExpired = (status: string, start: Date, now: Date, s: Pick<StaffingSettings, "swapNoticeHours">) => status === "open" && !swapAllowed(start, now, s);
/** Waiting on the supervisor longer than the approval window. */
export const swapOverdue = (acceptedAt: Date | null, now: Date, s: Pick<StaffingSettings, "swapApprovalHours">) =>
  !!acceptedAt && (now.getTime() - acceptedAt.getTime()) / HOUR > s.swapApprovalHours;

/* ---------- Acknowledgement (BR-4) ---------- */

export function ackState(publishedAt: Date, acknowledgedAt: Date | null, now: Date, s: Pick<StaffingSettings, "ackHours" | "ackReminderHours">): AckState {
  if (acknowledgedAt) return "acknowledged";
  const since = (now.getTime() - publishedAt.getTime()) / HOUR;
  return since >= s.ackHours ? "phone" : since >= s.ackReminderHours ? "remind" : "waiting";
}

/* ---------- Warnings on a shift (BR-1.4, 3.1 to 3.5) ---------- */

export type FitShift = { id?: string; date: string; startMin: number; endMin: number; role: string };
export type FitPerson = {
  contract: ContractKind;
  dateOfBirth: string | null;
  /** Qualifications held: type and expiry (null never expires). */
  quals: readonly { typeId: string; expiresOn: string | null }[];
  /** Their other shifts, at any site. */
  shifts: readonly FitShift[];
};
export type Fit = { kind: FitKind; text: string };

const minutesOf = (x: FitShift) => x.endMin - x.startMin;
const holds = (p: FitPerson, typeId: string | null, day: string) => !typeId || p.quals.some((q) => q.typeId === typeId && (!q.expiresOn || q.expiresOn >= day));
const absoluteMin = (date: string, min: number) => parseDateOnly(date).getTime() / 60_000 + min;

/** Everything worth knowing before putting a person on a shift. Nothing here refuses. */
export function fitWarnings(shift: FitShift, p: FitPerson, s: StaffingSettings): Fit[] {
  const out: Fit[] = [];
  if (!contractCovers(p.contract, shift.role)) out.push({ kind: "contract", text: shift.role === "lifeguard" ? "Their contract is swim teaching only; lifeguard shifts need a lifeguard contract." : "Their contract is lifeguarding only; teaching shifts need a swim teacher contract." });
  // A float needs the qualification of the work their contract is for.
  const guarding = shift.role === "lifeguard" || (shift.role === "float" && p.contract === "lifeguard");
  if (!holds(p, guarding ? s.lifeguardTypeId : s.teachingTypeId, shift.date)) out.push({ kind: "qualification", text: guarding ? "No current lifeguard qualification on that day." : "No current swim teacher qualification on that day." });
  if (!holds(p, s.vettingTypeId, shift.date)) out.push({ kind: "vetting", text: "No current Garda vetting on that day." });
  const others = p.shifts.filter((o) => o.id !== shift.id);
  const start = absoluteMin(shift.date, shift.startMin), end = absoluteMin(shift.date, shift.endMin);
  const clash = others.find((o) => o.date === shift.date && o.startMin < shift.endMin && shift.startMin < o.endMin);
  if (clash) out.push({ kind: "overlap", text: "Already on another shift at that time." });
  const young = p.dateOfBirth ? ageOn(p.dateOfBirth, shift.date) < 18 : false;
  const rest = young ? 12 : s.restHours;
  // Two shifts the same day are one working day with a gap, not two days needing rest between them.
  const shortest = Math.min(Infinity, ...others.filter((o) => o.date !== shift.date).map((o) => {
    const os = absoluteMin(o.date, o.startMin), oe = absoluteMin(o.date, o.endMin);
    return oe <= start ? start - oe : os >= end ? os - end : Infinity;
  }));
  if (shortest < rest * 60) out.push({ kind: "rest", text: `Only ${Math.floor(shortest / 60)}h ${shortest % 60}m off between shifts; ${rest} hours is the minimum${young ? " under 18" : ""}.` });
  const monday = mondayOf(shift.date), sunday = addDaysIso(monday, 6);
  const week = others.filter((o) => o.date >= monday && o.date <= sunday).reduce((n, o) => n + minutesOf(o), 0) + minutesOf(shift);
  if (week > s.weeklyCapHours * 60) out.push({ kind: "weekly", text: `${formatHours(week)} that week, over the ${s.weeklyCapHours}-hour cap unless overtime is approved.` });
  if (young) out.push({ kind: "young", text: "Under 18 on that day: check the young workers' limits." });
  return out;
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ---------- Contracted hours (BR-3.8) ---------- */

/** Each person's minutes in each week of a block, and how far below their contract the shortest
 *  week falls. Away shifts do not count. */
export function hoursAgainstContract(startsOn: string, shifts: readonly { userId: string | null; date: string; startMin: number; endMin: number; status: string }[], contracts: ReadonlyMap<string, number>) {
  const second = addDaysIso(startsOn, 7);
  const byPerson = new Map<string, [number, number]>();
  for (const x of shifts) {
    if (!x.userId || isAway(x.status)) continue;
    const weeks = byPerson.get(x.userId) ?? [0, 0];
    weeks[x.date >= second ? 1 : 0] += x.endMin - x.startMin;
    byPerson.set(x.userId, weeks);
  }
  for (const id of contracts.keys()) if (!byPerson.has(id)) byPerson.set(id, [0, 0]);
  return [...byPerson].map(([userId, weeks]) => {
    const contract = contracts.get(userId) ?? null;
    const short = contract === null ? 0 : Math.max(0, contract - Math.min(...weeks));
    return { userId, weeks, contract, short };
  });
}

/* ---------- Building a block (BR-5.3 step 1) ---------- */

export type SlotForBlock = { id: string; weekday: number; role: string; name: string; startMin: number; endMin: number; needed: number };

/** The places a block needs: each slot on each of its days, `needed` times. When the block before
 *  had the same slot on the same weekday of the same week of its block, its people carry over in
 *  order ("copy the previous block"). */
export function placesFor(startsOn: string, slots: readonly SlotForBlock[], previous: { startsOn: string; shifts: readonly { slotId: string | null; date: string; userId: string | null }[] } | null, keep: (userId: string) => boolean) {
  const out: { slotId: string; date: string; role: string; name: string; startMin: number; endMin: number; userId: string | null }[] = [];
  for (const [i, date] of blockDays(startsOn).entries()) {
    const weekday = isoWeekday(date);
    const before = previous ? addDaysIso(previous.startsOn, i) : null;
    for (const slot of slots.filter((x) => x.weekday === weekday)) {
      const carried = before ? previous!.shifts.filter((x) => x.slotId === slot.id && x.date === before && x.userId && keep(x.userId)).map((x) => x.userId!) : [];
      for (let n = 0; n < slot.needed; n += 1) {
        out.push({ slotId: slot.id, date, role: slot.role, name: slot.name, startMin: slot.startMin, endMin: slot.endMin, userId: carried[n] ?? null });
      }
    }
  }
  return out;
}

export const isoDay = (d: Date) => toDateOnlyString(d);

/* ---------- Who could take a shift (BR-5.3 steps 3 and 4, BR-8.6) ---------- */

export type Candidate = { id: string; name: string; contract: ContractKind; dateOfBirth: string | null; quals: FitPerson["quals"]; contractMinutes: number | null; wantsMore: boolean; strikes: number };
const SERIOUS: readonly FitKind[] = ["contract", "qualification", "vetting", "overlap"];

/** Everyone who could take a shift, best first: nothing serious in the way, then people below
 *  their contracted hours that week, then those wanting extra hours with no strikes this semester,
 *  then the rest; fewer warnings first. Warnings push a name down and never remove it. */
export function rankFits(shift: FitShift, people: readonly Candidate[], shifts: readonly (FitShift & { userId: string })[], s: StaffingSettings) {
  const monday = mondayOf(shift.date), sunday = addDaysIso(monday, 6);
  return people.map((p) => {
    const mine = shifts.filter((x) => x.userId === p.id);
    const warnings = fitWarnings(shift, { ...p, shifts: mine }, s);
    const week = mine.filter((x) => x.id !== shift.id && x.date >= monday && x.date <= sunday).reduce((n, x) => n + x.endMin - x.startMin, 0);
    const belowContract = p.contractMinutes !== null && week < p.contractMinutes;
    const tier = belowContract ? 0 : p.wantsMore && p.strikes === 0 ? 1 : p.wantsMore ? 2 : 3;
    const serious = warnings.some((w) => SERIOUS.includes(w.kind));
    return { ...p, warnings, week, belowContract, tier, serious };
  }).sort((a, b) => Number(a.serious) - Number(b.serious) || a.tier - b.tier || a.warnings.length - b.warnings.length || a.strikes - b.strikes || a.name.localeCompare(b.name));
}
export type RankedFit = ReturnType<typeof rankFits>[number];
