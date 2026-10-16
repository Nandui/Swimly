/** Why a swimmer leaves a class (owner decision, 16 October 2026). Asked when
 *  a place is withdrawn or its last lesson is scheduled, and read by Analytics
 *  to explain leavers. Keys are stored on `Enrolment.leaveReason`: never
 *  rename one; add new keys and retire old ones by leaving them out of
 *  `LEAVE_REASON_CHOICES`. Client-safe. */
export const LEAVE_REASONS = {
  moving: "Moving away or changing pool",
  timing: "Day or time no longer suits",
  cost: "Cost",
  progress: "Not happy with progress",
  teaching: "Not happy with the teacher or class",
  enjoyment: "Not enjoying swimming",
  health: "Illness, injury or medical",
  "other-activity": "Busy with another activity",
  stopping: "Can swim now, stopping lessons",
  unknown: "Didn't say",
  other: "Something else",
} as const;

export type LeaveReason = keyof typeof LEAVE_REASONS;

export const LEAVE_REASON_CHOICES = Object.entries(LEAVE_REASONS).map(([value, label]) => ({ value, label }));

export function isLeaveReason(value: unknown): value is LeaveReason {
  return typeof value === "string" && Object.hasOwn(LEAVE_REASONS, value);
}

/** The label for a stored key; old or unknown keys read as not recorded. */
export function leaveReasonLabel(value: string | null | undefined) {
  return isLeaveReason(value) ? LEAVE_REASONS[value] : "Not recorded";
}
