import type { TagColor } from "@/components/ui-kit/tag";
import type { AssessmentBookingStatus } from "@/generated/prisma/client";
import { formatTime } from "@/lib/courses/constants";
import { formatDate } from "@/lib/format";

/** Domain vocabulary for assessments. Status colour comes from here and
 *  nowhere else — one metadata map, tints from the nine. */
export const BOOKING_STATUS_META: Record<
  AssessmentBookingStatus,
  { label: string; color: TagColor }
> = {
  BOOKED: { label: "Booked", color: "blue" },
  ATTENDED: { label: "Attended", color: "green" },
  NO_SHOW: { label: "Did not come", color: "orange" },
  CANCELLED: { label: "Cancelled", color: "gray" },
};

/** Bookings that hold a place. A cancellation or a no-show gives it back. */
export const HOLDS_A_PLACE: AssessmentBookingStatus[] = ["BOOKED", "ATTENDED"];

type SessionLike = { date: Date; startMinutes: number };

/** "Sat 5 Sep 2026, 13:30" — how someone plans around it. */
export function sessionLabel(session: SessionLike): string {
  return `${formatDate(session.date)}, ${formatTime(session.startMinutes)}`;
}

/** "13:30–14:00". */
export function sessionSpan(session: SessionLike & { durationMinutes: number }): string {
  return `${formatTime(session.startMinutes)}–${formatTime(
    session.startMinutes + session.durationMinutes
  )}`;
}

/** A session in the past is one whose day has ended, school time. A session
 *  today is still upcoming until it has been run, which is a decision the
 *  assessor makes by recording outcomes, not one the clock makes for them. */
export function isPast(session: { date: Date }, todayIso: string): boolean {
  return session.date.toISOString().slice(0, 10) < todayIso;
}
