import { CalendarCheck, Check, CircleCheck, Clock, Hourglass, Wallet, X } from "lucide-react";
import type { TagMeta } from "@/components/ui-kit/tag";
import type { BookingState, Course } from "@/lib/api";

/** Dates come as "2026-11-07" (a day, not an instant), so they are read in UTC. */
const DAY = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
const LONG = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const part = (f: Intl.DateTimeFormat, d: Date, type: string) => f.formatToParts(d).find((p) => p.type === type)?.value ?? "";
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "Sat 7 Nov" */
export function day(iso: string) {
  const d = asDate(iso);
  return `${part(DAY, d, "weekday")} ${part(DAY, d, "day")} ${part(DAY, d, "month")}`;
}
/** "Saturday 7 November" */
export function longDay(iso: string) {
  const d = asDate(iso);
  return `${part(LONG, d, "weekday")} ${part(LONG, d, "day")} ${part(LONG, d, "month")}`;
}

/** "Sat 7 Nov to Sun 15 Nov" */
export function span(first: string | null, last: string | null) {
  if (!first) return "";
  return last && last !== first ? `${day(first)} to ${day(last)}` : day(first);
}

/** How a course runs, in words: "6 Tuesdays, 18:00 to 19:00" when weekly at one time, else the
 *  number of days. */
export function rhythm(c: Pick<Course, "sessions" | "group">) {
  const n = c.sessions.length;
  if (!n) return "";
  const weekdays = new Set(c.sessions.map((s) => asDate(s.date).getUTCDay()));
  const times = new Set(c.sessions.map((s) => `${s.start}-${s.end}`));
  if (n > 1 && weekdays.size === 1 && times.size === 1) {
    const weekday = new Intl.DateTimeFormat("en-IE", { timeZone: "UTC", weekday: "long" }).format(asDate(c.sessions[0].date));
    return `${n} ${weekday}s, ${c.sessions[0].start} to ${c.sessions[0].end}`;
  }
  return `${n} ${n === 1 ? "day" : c.group === "course" ? "sessions" : "days"}`;
}

export type Meta = TagMeta;

/** How many places are left, always with an icon so colour is never the only signal. */
export function placesMeta(c: Pick<Course, "placesLeft" | "waitingList">): Meta {
  if (c.placesLeft <= 0) return c.waitingList ? { label: "Full, waiting list open", color: "orange", icon: Hourglass } : { label: "Full", color: "red", icon: X };
  if (c.placesLeft <= 2) return { label: `${c.placesLeft} ${c.placesLeft === 1 ? "place" : "places"} left`, color: "orange", icon: Clock };
  return { label: `${c.placesLeft} places left`, color: "green", icon: Check };
}

/** Where a booking stands, for "My bookings". */
export const BOOKING_META: Record<BookingState, Meta> = {
  "to-pay": { label: "Waiting for payment", color: "orange", icon: Wallet },
  booked: { label: "Booked", color: "green", icon: CalendarCheck },
  waiting: { label: "Waiting list", color: "blue", icon: Hourglass },
  done: { label: "Finished", color: "gray", icon: CircleCheck },
  withdrawn: { label: "Withdrawn", color: "gray", icon: X },
  cancelled: { label: "Cancelled", color: "red", icon: X },
};

const EURO = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
export const euro = (cents: number) => EURO.format(cents / 100);

export const SITE_NAME = process.env.NEXT_PUBLIC_ACADEMY_NAME?.trim() || "LeisureWorld Academy";

/** A date as the parents app's ticket shows it: the month over the day ("Nov", "7"). */
export function dateBlock(iso: string) {
  const d = asDate(iso);
  return { month: part(DAY, d, "month"), day: part(DAY, d, "day"), weekday: part(DAY, d, "weekday") };
}
