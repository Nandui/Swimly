import { Ban, BriefcaseMedical, UserRoundX, CalendarClock, CircleCheck, CircleDashed, Clock, Coins, Dumbbell, FileWarning, Globe, HandCoins, Hourglass, PersonStanding, PlayCircle, Shapes, Ticket, TriangleAlert, Wallet, Waves } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** The rules for short courses (owner decision, 13 October 2026). Pure,
 *  so they are tested on their own and every screen reads them the same way. */

/** Where in the centre a course happens. Presentation only: the session's own area is the
 *  site's area (Admin, Areas). */
export const SHORT_COURSE_AREA_META = {
  pool: { label: "Pool", color: "blue", icon: Waves },
  gym: { label: "Gym", color: "orange", icon: Dumbbell },
  studio: { label: "Studio", color: "purple", icon: PersonStanding },
  other: { label: "Other", color: "gray", icon: Shapes },
} as const satisfies Record<string, StatusMeta>;
export type ShortCourseArea = keyof typeof SHORT_COURSE_AREA_META;
export const SHORT_COURSE_AREAS = Object.keys(SHORT_COURSE_AREA_META) as ShortCourseArea[];

/** A course's state. "Running" is worked out: planned, with its first session come. */
export const SHORT_COURSE_META = {
  planned: { label: "Planned", color: "blue", icon: CalendarClock },
  running: { label: "Running", color: "green", icon: PlayCircle },
  finished: { label: "Finished", color: "gray", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "red", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type ShortCourseState = keyof typeof SHORT_COURSE_META;

export const SHORT_COURSE_PAYMENT_META = {
  paid: { label: "Paid", color: "green", icon: Wallet },
  deposit: { label: "Deposit paid", color: "orange", icon: HandCoins },
  owed: { label: "Owed", color: "red", icon: Coins },
  waived: { label: "No charge", color: "gray", icon: CircleDashed },
} as const satisfies Record<string, StatusMeta>;
export type ShortCoursePayment = keyof typeof SHORT_COURSE_PAYMENT_META;
export const SHORT_COURSE_PAYMENTS = Object.keys(SHORT_COURSE_PAYMENT_META) as ShortCoursePayment[];

/** Where someone stands on a course. Only booked takes a place; the waiting list is first come,
 *  first served. */
export const SHORT_COURSE_PLACE_META = {
  booked: { label: "Booked", color: "blue", icon: Ticket },
  waiting: { label: "Waiting list", color: "orange", icon: Hourglass },
  withdrawn: { label: "Withdrawn", color: "gray", icon: Ban },
} as const satisfies Record<string, StatusMeta>;

/** A course that asks for a health form, from someone who has not handed one in. */
export const HEALTH_FORM_META = {
  missing: { label: "No health form", color: "orange", icon: FileWarning },
} as const satisfies Record<string, StatusMeta>;

/** A booking's swimmer record (owner request, 21 October 2026), for short courses and Academy
 *  courses alike: medical notes on file (read in the person's dialog, never in a list), or a
 *  booking made before the records that still needs linking. */
export const SWIMMER_RECORD_META = {
  medical: { label: "Medical notes", color: "red", icon: BriefcaseMedical },
  unlinked: { label: "No swimmer record", color: "gray", icon: UserRoundX },
} as const satisfies Record<string, StatusMeta>;

/** Online booking (phase 2): a place held on the booking site, and how soon the desk must phone
 *  to take payment (72 hours from holding it). */
export const SHORT_COURSE_ONLINE_META = {
  online: { label: "Booked online", color: "purple", icon: Globe },
} as const satisfies Record<string, StatusMeta>;
export const SHORT_COURSE_CALL_DUE_META = {
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
  soon: { label: "Phone within a day", color: "orange", icon: Clock },
  later: { label: "To phone", color: "blue", icon: Clock },
} as const satisfies Record<string, StatusMeta>;

/** When they would like a call, in words. */
export const SHORT_COURSE_CALL_TIMES: Record<string, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

/** Someone who held a place online and still owes: the desk phones them. */
export const toPhone = (p: { source: string; status: string; payment: string; callBy: Date | null }) => p.source === "online" && p.status === "booked" && p.payment === "owed" && p.callBy !== null;

export const takesPlace = (status: string) => status === "booked";

/** Only Pool courses can be shown in the parents app (owner decision, 21 October 2026). */
export const appCourseArea = (area: string) => area === "pool";

/** Shown in the parents app: a Pool course Manage ticked, still planned, its first session to come. */
export function inParentsApp(c: { bookOnline: boolean; status: string; cancelledAt: Date | null }, area: string, firstDay: string | null, today: string) {
  return c.bookOnline && appCourseArea(area) && !c.cancelledAt && c.status === "planned" && !!firstDay && firstDay > today;
}

export function courseState(c: { status: string; cancelledAt: Date | null }, firstDay: string | null, today: string): ShortCourseState {
  if (c.cancelledAt || c.status === "cancelled") return "cancelled";
  if (c.status === "finished") return "finished";
  return firstDay && firstDay <= today ? "running" : "planned";
}

/** The most weeks a course can run for, and the longest session. */
export const MAX_WEEKS = 26;
export const MAX_SESSION_MINUTES = 240;

/** The days of a weekly course: the first day, then the same weekday each week. */
export function weeklyDates(firstDay: string, weeks: number): string[] {
  const start = new Date(`${firstDay}T00:00:00Z`);
  return Array.from({ length: weeks }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d.toISOString().slice(0, 10);
  });
}

/** The waiting list in order: whoever was put on it first. */
export function waitingOrder<T extends { status: string; createdAt: Date }>(people: readonly T[]): T[] {
  return people.filter((p) => p.status === "waiting").sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Whole years old on a day. */
export function ageOn(dateOfBirth: string, on: string) {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const [ty, tm, td] = on.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

/** "09:00" from minutes after midnight, and back (null when it is not a time). */
export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function clockOf(value: string) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const euro = (cents: number) => EURO.format(cents / 100);
/** "90", "90.00" or "€90" → cents, or null. */
export function centsOf(value: string): number | null {
  const clean = value.trim().replace(/[€,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

/** What someone still owes on a course: the price less what they paid, never below nothing. */
export const stillOwed = (priceCents: number, p: { payment: string; paidCents: number }) => (p.payment === "waived" || p.payment === "paid" ? 0 : Math.max(0, priceCents - p.paidCents));
