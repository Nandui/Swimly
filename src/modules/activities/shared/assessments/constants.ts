import { CalendarCheck, CircleCheck, CircleHelp, Tag as TagIcon, UserX, Users, XCircle } from "lucide-react";
import type { AssessmentBookingStatus } from "@/generated/prisma/client";
import { formatDate, formatDay, formatTime, formatTimeRange } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";

export const SESSION_STATUS_META = {
  cancelled: { label: "Cancelled", color: "gray", icon: XCircle },
  full: { label: "Full", color: "orange", icon: Users },
  missingKind: { label: "Kind not set", color: "orange", icon: TagIcon },
  unassigned: { label: "Not decided", color: "orange", icon: CircleHelp },
} as const satisfies Record<string, StatusMeta>;

/** Domain vocabulary for assessments. Status tone and icon come from here and
 *  nowhere else. */
export const BOOKING_STATUS_META: Record<AssessmentBookingStatus, StatusMeta> = {
  BOOKED: { label: "Booked", color: "blue", icon: CalendarCheck },
  ATTENDED: { label: "Attended", color: "green", icon: CircleCheck },
  NO_SHOW: { label: "Did not come", color: "orange", icon: UserX },
  CANCELLED: { label: "Cancelled", color: "gray", icon: XCircle },
};

/** Bookings that hold a place. A cancellation or a no-show gives it back. */
export const HOLDS_A_PLACE: AssessmentBookingStatus[] = ["BOOKED", "ATTENDED"];

type SessionLike = { date: Date; startMinutes: number };

/** "Sat 5 Sep 2026, 13:30" — how someone plans around it. */
export function sessionLabel(session: SessionLike): string {
  return `${formatDate(session.date)}, ${formatTime(session.startMinutes)}`;
}

/** "Wednesday 2 September": the day named, because a parent books "the
 *  Saturday one", not the 5th. */
export function sessionDay(session: { date: Date }): string {
  return formatDay(session.date);
}

/** "13:30 to 14:00". */
export function sessionSpan(session: SessionLike & { durationMinutes: number }): string {
  return formatTimeRange(session.startMinutes, session.startMinutes + session.durationMinutes);
}

/** A session in the past is one whose day has ended, school time. A session
 *  today is still upcoming until it has been run, which is a decision the
 *  assessor makes by recording outcomes, not one the clock makes for them. */
export function isPast(session: { date: Date }, todayIso: string): boolean {
  return session.date.toISOString().slice(0, 10) < todayIso;
}
