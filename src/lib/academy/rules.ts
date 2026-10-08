import { Ban, CalendarClock, CircleCheck, CircleDashed, CircleX, Coins, HandCoins, LifeBuoy, PlayCircle, RotateCcw, School, Shapes, Wallet } from "lucide-react";
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
