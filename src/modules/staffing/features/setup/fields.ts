import type { StaffingSettings } from "@/modules/staffing/shared/rules";

/** The settings form's fields, with their labels: a plain module so the settings page and its dialog share them. */
type NumberKey = { [K in keyof StaffingSettings]: StaffingSettings[K] extends number ? K : never }[keyof StaffingSettings];
type TimeKey = "publishTime" | "lateShiftFrom" | "lateShiftCallBy" | "earlyShiftCallBy";
export const NUMBERS: [NumberKey, string, string][] = [
  ["startOffsetWeeks", "Weeks ahead a block starts", "Published on the Friday, starting this many weeks later."],
  ["minNoticeHours", "Minimum notice, hours", "Legal minimum 24."],
  ["ackHours", "Acknowledge within, hours", ""],
  ["ackReminderHours", "Reminder after, hours", ""],
  ["swapNoticeHours", "Swaps close, hours before", ""],
  ["swapApprovalHours", "Decide swaps within, hours", ""],
  ["maxGiveaways", "Shifts given away per block", "More is flagged."],
  ["callMinimumHours", "Exceptional call-off, hours before", ""],
  ["lateArrivalMinutes", "Late arrival strike, minutes", ""],
  ["restHours", "Rest between shifts, hours", "Legal minimum 11."],
  ["weeklyCapHours", "Weekly cap, hours", "Unless overtime is approved."],
  ["examDeadlineDays", "Exam absences due, days before", ""],
  ["clashFlag", "Short-notice clash flag at", "Per semester."],
  ["strikeDueDays", "Strike 2 and 3 due within, days", ""],
];
export const TIMES: [TimeKey, string, string][] = [
  ["publishTime", "Publish by, on the Friday", ""],
  ["lateShiftFrom", "A late shift starts from", "Open question: assumed noon until HR confirms."],
  ["lateShiftCallBy", "Late shift: call by, same day", ""],
  ["earlyShiftCallBy", "Early shift: call by, the day before", ""],
];

