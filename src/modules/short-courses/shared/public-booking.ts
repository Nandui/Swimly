import { randomInt } from "node:crypto";
import { z } from "zod";
import { isDateOnly } from "@/lib/format";

/** The shape of the public booking site (academy.leisureworldcork.com, docs/academy.md): what
 *  each kind of course (Academy courses, short courses) shows, takes and reports back. Each is a
 *  source (features/booking/server/academy.ts and courses.ts); the site's API lists every
 *  source's courses, holds places and shows a customer their own bookings.
 *
 *  We cannot take payment online (owner decision, 8 October 2026): a place held online is owed,
 *  and the desk phones within 72 hours to take payment. */

/** Hours from holding a place online to the call for payment. */
export const ONLINE_HOLD_HOURS = 72;
export const holdDeadline = (heldAt: Date) => new Date(heldAt.getTime() + ONLINE_HOLD_HOURS * 3_600_000);

/** When someone would like a call. */
export const CALL_TIMES = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;
export const CALL_TIME_KEYS = Object.keys(CALL_TIMES) as (keyof typeof CALL_TIMES)[];

/** One course as the public see it: never staff names, other people or notes. */
export type PublicCourse = {
  id: string;
  /** Which kind: "academy" or "short-courses". */
  source: string;
  name: string;
  /** "qualification" (Academy courses with a certificate) or "course" (weekly courses). */
  group: "qualification" | "course";
  /** A short key for filtering ("lifeguard", "pool", "gym") and its words. */
  category: string;
  categoryLabel: string;
  description: string;
  awardingBody: string;
  minAge: number | null;
  /** Things asked for before the course, in words: "Swim test", "Health form". */
  checks: string[];
  askDateOfBirth: boolean;
  site: string;
  priceCents: number;
  price: string;
  placesLeft: number;
  /** When full, people can still join a waiting list. */
  waitingList: boolean;
  firstDay: string | null;
  lastDay: string | null;
  sessions: { date: string; start: string; end: string; place: string }[];
};

const phoneSchema = z.string().trim().max(30).refine((v) => /^\+?[\d\s()-]+$/.test(v) && (v.match(/\d/g) ?? []).length >= 7 && (v.match(/\d/g) ?? []).length <= 15,
  "Enter a phone number we can call, like 087 123 4567.");

/** What someone gives to hold a place. A source checks the date of birth when it asks for one. */
export const holdSchema = z.object({
  courseId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  name: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  phone: phoneSchema,
  phone2: z.union([z.literal(""), phoneSchema]).default(""),
  dateOfBirth: z.string().refine((v) => v === "" || isDateOnly(v), "Enter your date of birth.").default(""),
  callTimes: z.array(z.enum(CALL_TIME_KEYS as [string, ...string[]])).max(3).default([]),
  note: z.string().trim().max(500, "Keep the note under 500 characters.").default(""),
  /** The course is full: put them on its waiting list instead (only where it has one). */
  waitingList: z.boolean().default(false),
}).strict();
export type HoldInput = z.output<typeof holdSchema>;

/** What holding a place made: a held place to phone about, or a place on the waiting list. */
export type PublicHold = {
  reference: string;
  outcome: "held" | "waiting";
  callBy: string | null;
  callByLabel: string | null;
  phone: string;
  price: string;
  course: { name: string; site: string; starts: string };
};

/** Where a customer's booking stands, for "My bookings". */
export type CustomerBookingState = "to-pay" | "booked" | "waiting" | "done" | "withdrawn" | "cancelled";
export type CustomerBooking = {
  id: string;
  source: string;
  reference: string | null;
  courseId: string;
  name: string;
  /** The name it was booked under (one email can book for several people). */
  person: string;
  categoryLabel: string;
  site: string;
  firstDay: string | null;
  lastDay: string | null;
  sessions: number;
  next: { date: string; start: string; end: string; place: string } | null;
  state: CustomerBookingState;
  /** A result or finer detail, e.g. "Passed", "Deposit paid". */
  detail: string;
  priceCents: number;
  paidCents: number;
  owedCents: number;
  callBy: string | null;
};

/** One kind of course on the public site. Errors meant for the customer are thrown as
 *  PublicApiError (src/lib/public-api/http.ts). */
export type PublicCourseSource = {
  id: string;
  list(): Promise<PublicCourse[]>;
  one(id: string): Promise<PublicCourse | null>;
  hold(email: string, input: HoldInput): Promise<PublicHold>;
  bookingsFor(email: string): Promise<CustomerBooking[]>;
};

const REFERENCE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** A booking reference, "AC-4K8PZ": no 0/O or 1/I to misread over the phone. */
export const newReference = (prefix: string) => `${prefix}-${Array.from({ length: 5 }, () => REFERENCE_LETTERS[randomInt(0, REFERENCE_LETTERS.length)]).join("")}`;

const DAY = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const WHEN = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const parts = (f: Intl.DateTimeFormat, d: Date) => (t: string) => f.formatToParts(d).find((x) => x.type === t)?.value ?? "";
/** "Sat 7 Nov" for a date-only value. */
export function dayWords(d: Date) { const p = parts(DAY, d); return `${p("weekday")} ${p("day")} ${p("month")}`; }
/** "Sat 7 Nov, 14:05" in Dublin time. */
export function whenWords(d: Date) { const p = parts(WHEN, d); return `${p("weekday")} ${p("day")} ${p("month")}, ${p("hour")}:${p("minute")}`; }

const DUBLIN_TIME = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hour12: false });
const DUBLIN_ISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" });

/** How soon the desk must phone about a place held online: past the deadline, within a day, or
 *  later, and how to say it after "Phone by": "today 21:10", "tomorrow 09:00", "Fri 9 Oct, 14:00",
 *  or "Overdue by 6 h". */
export function callDue(callBy: Date, now: Date = new Date()): { due: "overdue" | "soon" | "later"; label: string } {
  const left = callBy.getTime() - now.getTime();
  if (left <= 0) {
    const hours = Math.floor(-left / 3_600_000);
    return { due: "overdue", label: hours < 1 ? "Overdue" : hours < 48 ? `Overdue by ${hours} h` : `Overdue by ${Math.floor(hours / 24)} days` };
  }
  const time = DUBLIN_TIME.format(callBy);
  const day = DUBLIN_ISO.format(callBy);
  const label = day === DUBLIN_ISO.format(now) ? `today ${time}` : day === DUBLIN_ISO.format(new Date(now.getTime() + 86_400_000)) ? `tomorrow ${time}` : whenWords(callBy);
  return { due: left <= 86_400_000 ? "soon" : "later", label };
}
