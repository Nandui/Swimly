import { Ban, CalendarClock, CircleCheck, CircleDashed, CircleX, Clock, Coins, HandCoins, LifeBuoy, PhoneCall, PhoneMissed, PlayCircle, RotateCcw, School, Shapes, TriangleAlert, Wallet } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** The Academy's rules (owner decision, 8 October 2026; docs/academy.md). Pure, so they are
 *  tested on their own and every screen reads them the same way. */

export const ACADEMY_KIND_META = {
  lifeguard: { label: "Lifeguard", color: "blue", icon: LifeBuoy },
  "swim-teacher": { label: "Swim teacher", color: "purple", icon: School },
  other: { label: "Other", color: "gray", icon: Shapes },
} as const satisfies Record<string, StatusMeta>;
export type AcademyKind = keyof typeof ACADEMY_KIND_META;
export const ACADEMY_KINDS = Object.keys(ACADEMY_KIND_META) as AcademyKind[];

/** A course's state. "Running" is worked out: planned, with its first session come. */
export const ACADEMY_COURSE_META = {
  planned: { label: "Planned", color: "blue", icon: CalendarClock },
  running: { label: "Running", color: "green", icon: PlayCircle },
  completed: { label: "Completed", color: "gray", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "red", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type AcademyCourseState = keyof typeof ACADEMY_COURSE_META;

export const ACADEMY_PAYMENT_META = {
  paid: { label: "Paid", color: "green", icon: Wallet },
  deposit: { label: "Deposit paid", color: "orange", icon: HandCoins },
  owed: { label: "Owed", color: "red", icon: Coins },
  waived: { label: "No charge", color: "gray", icon: CircleDashed },
} as const satisfies Record<string, StatusMeta>;
export type AcademyPayment = keyof typeof ACADEMY_PAYMENT_META;
export const ACADEMY_PAYMENTS = Object.keys(ACADEMY_PAYMENT_META) as AcademyPayment[];

export const ACADEMY_RESULT_META = {
  booked: { label: "Booked", color: "blue", icon: CalendarClock },
  withdrawn: { label: "Withdrawn", color: "gray", icon: Ban },
  passed: { label: "Passed", color: "green", icon: CircleCheck },
  referred: { label: "Referred", color: "orange", icon: RotateCcw },
  failed: { label: "Not yet competent", color: "red", icon: CircleX },
} as const satisfies Record<string, StatusMeta>;
export type AcademyResult = keyof typeof ACADEMY_RESULT_META;
/** The results an assessor records at the end. */
export const ACADEMY_OUTCOMES = ["passed", "referred", "failed"] as const;

/** The pre-course checks a course type can ask for. Age is read from the date of birth. */
export const ACADEMY_CHECKS = {
  age: "Minimum age",
  swim: "Swim test",
  medical: "Medical form",
  id: "Photo ID",
} as const;
export type AcademyCheck = keyof typeof ACADEMY_CHECKS;
export const ACADEMY_CHECK_KEYS = Object.keys(ACADEMY_CHECKS) as AcademyCheck[];

export function courseState(c: { status: string; cancelledAt: Date | null }, firstDay: string | null, today: string): AcademyCourseState {
  if (c.cancelledAt || c.status === "cancelled") return "cancelled";
  if (c.status === "completed") return "completed";
  return firstDay && firstDay <= today ? "running" : "planned";
}

/** Whole years old on a day. */
export function ageOn(dateOfBirth: string, on: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** Where a candidate stands before assessment: each check the course asks for (done, or what is
 *  missing), and their hours against the minimum. `ready` when all are met. */
export function readiness(
  type: { checks: readonly string[]; minAge: number | null; minHours: number },
  candidate: { dateOfBirth: string | null; swimTestOn: string | null; medicalOn: string | null; idCheckedOn: string | null },
  firstDay: string | null,
  attendedMinutes: number,
) {
  const checks = type.checks.filter((k): k is AcademyCheck => k in ACADEMY_CHECKS).map((key) => {
    if (key === "age") {
      if (!candidate.dateOfBirth) return { key, label: ACADEMY_CHECKS.age, done: false, detail: "Date of birth needed" };
      const age = ageOn(candidate.dateOfBirth, firstDay ?? candidate.dateOfBirth);
      const ok = type.minAge === null || age >= type.minAge;
      return { key, label: ACADEMY_CHECKS.age, done: ok, detail: ok ? `${age} on the first day` : `${age} on the first day; needs ${type.minAge}` };
    }
    const on = key === "swim" ? candidate.swimTestOn : key === "medical" ? candidate.medicalOn : candidate.idCheckedOn;
    return { key, label: ACADEMY_CHECKS[key], done: !!on, detail: on ? `Done ${on}` : "Not done" };
  });
  const hoursOk = attendedMinutes >= type.minHours * 60;
  return { checks, hoursOk, attendedMinutes, ready: checks.every((c) => c.done) && hoursOk };
}

/** Places taken: everyone on the course but those who withdrew. */
export const takesPlace = (status: string) => status !== "withdrawn";

/** A qualification's expiry from a pass: the certificate's own date, else the qualification's
 *  validity from the result day, else none. */
export function expiryFrom(resultOn: string, certificateExpires: string | null, validityMonths: number | null) {
  if (certificateExpires) return certificateExpires;
  if (!validityMonths) return null;
  const d = new Date(`${resultOn}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + validityMonths);
  return d.toISOString().slice(0, 10);
}

/** "12h 30m" of a course's hours. */
export function hoursLabel(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const euro = (cents: number) => EURO.format(cents / 100);
/** "350", "350.00" or "€350" → cents, or null. */
export function centsOf(value: string): number | null {
  const clean = value.trim().replace(/[€,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/* ---------- Online booking (owner decision, 8 October 2026) ----------
   People hold a place on the booking site; we cannot take payment online, so reception phones
   them within 72 hours of holding it. The place stays held until someone records the call. */

/** Hours from holding a place online to the call for payment. */
export const ONLINE_HOLD_HOURS = 72;

/** When they would like a call. */
export const ACADEMY_CALL_TIMES = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;
export type AcademyCallTime = keyof typeof ACADEMY_CALL_TIMES;
export const ACADEMY_CALL_TIME_KEYS = Object.keys(ACADEMY_CALL_TIMES) as AcademyCallTime[];

/** What came of a call. Paid and not going ahead take them off the list to call. */
export const ACADEMY_CALL_META = {
  paid: { label: "Paid", color: "green", icon: Wallet },
  "no-answer": { label: "No answer", color: "gray", icon: PhoneMissed },
  "call-back": { label: "Asked us to call back", color: "blue", icon: PhoneCall },
  "not-going-ahead": { label: "Not going ahead", color: "red", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type AcademyCallOutcome = keyof typeof ACADEMY_CALL_META;
export const ACADEMY_CALL_OUTCOMES = Object.keys(ACADEMY_CALL_META) as AcademyCallOutcome[];

/** How soon to call: past the deadline, within a day, or later. */
export const ACADEMY_CALL_DUE_META = {
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
  soon: { label: "Call within a day", color: "orange", icon: Clock },
  later: { label: "To call", color: "blue", icon: Clock },
} as const satisfies Record<string, StatusMeta>;
export type AcademyCallDue = keyof typeof ACADEMY_CALL_DUE_META;

/** The deadline for a place held at `heldAt`. */
export function callByFrom(heldAt: Date) {
  return new Date(heldAt.getTime() + ONLINE_HOLD_HOURS * 3_600_000);
}

const DUBLIN_TIME = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hour12: false });
const DUBLIN_DAY = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short" });
const DUBLIN_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" });

/** Where a call stands and how to say it: "Overdue by 6 h", or when it is due, to follow "Call by":
 *  "today 21:10", "tomorrow 09:00", "Fri 9 Oct, 14:00". */
export function callDue(callBy: Date, now: Date = new Date()): { due: AcademyCallDue; label: string } {
  const left = callBy.getTime() - now.getTime();
  if (left <= 0) {
    const hours = Math.floor(-left / 3_600_000);
    return { due: "overdue", label: hours < 1 ? "Overdue" : hours < 48 ? `Overdue by ${hours} h` : `Overdue by ${Math.floor(hours / 24)} days` };
  }
  const time = DUBLIN_TIME.format(callBy);
  const day = DUBLIN_ISO.format(callBy), on = DUBLIN_ISO.format(now);
  const tomorrow = DUBLIN_ISO.format(new Date(now.getTime() + 86_400_000));
  const part = (type: string) => DUBLIN_DAY.formatToParts(callBy).find((p) => p.type === type)?.value ?? "";
  const when = day === on ? `today ${time}` : day === tomorrow ? `tomorrow ${time}` : `${part("weekday")} ${part("day")} ${part("month")}, ${time}`;
  return { due: left <= 86_400_000 ? "soon" : "later", label: when };
}

/** What an amount taken over the phone makes the payment: the full price or more is paid, less
 *  is a deposit (the place is then secured and they leave the list to call). */
export function paymentFor(amountCents: number, priceCents: number): "paid" | "deposit" {
  return amountCents >= priceCents ? "paid" : "deposit";
}

/** A course people can hold a place on online: put online, not cancelled or finished, and not
 *  started yet. Places left are worked out separately. */
export function bookableOnline(c: { bookOnline: boolean; status: string; cancelledAt: Date | null }, firstDay: string | null, today: string) {
  return c.bookOnline && !c.cancelledAt && c.status === "planned" && !!firstDay && firstDay > today;
}
