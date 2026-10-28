import { addDaysIso } from "@/lib/format";

/** How far ahead a class or a whole day can be cancelled (owner decision, 28 October 2026):
 *  today and the next four weeks, never a past day. */
export const CANCEL_AHEAD_DAYS = 28;

export function cancelWindow(todayIso: string) {
  return { from: todayIso, to: addDaysIso(todayIso, CANCEL_AHEAD_DAYS) };
}

export function inCancelWindow(iso: string, todayIso: string) {
  const { from, to } = cancelWindow(todayIso);
  return iso >= from && iso <= to;
}

/** Billing has not acted on it yet: not sent to Legend, not marked notified. */
export function awaitingBilling(row: { billingNotifiedAt: Date | null; legendProcessedAt: Date | null }) {
  return !row.billingNotifiedAt && !row.legendProcessedAt;
}

/** A cancellation can be undone while billing has not acted on it and the class has not started:
 *  a later day, or today before its start time, with no teacher or attendance recorded. */
export function undoBlocker(row: { date: Date; startMinutes: number; attendanceRecorded: number; billingNotifiedAt: Date | null; legendProcessedAt: Date | null },
  todayIso: string, nowMinutes: number, started: boolean): string | null {
  if (!awaitingBilling(row)) return "Billing has already acted on this cancellation, so it can no longer be undone.";
  const iso = row.date.toISOString().slice(0, 10);
  if (iso < todayIso || (iso === todayIso && nowMinutes >= row.startMinutes)) return "This class’s start time has passed, so the cancellation can no longer be undone.";
  if (started || row.attendanceRecorded > 0) return "This class has a teacher or attendance recorded, so the cancellation stays.";
  return null;
}
