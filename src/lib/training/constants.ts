import type { StatusMeta } from "@/lib/status";

/** Training status tones come from here, never from a call site. Each state
 *  also has its own icon in `TrainingStatusTag`, so colour is never the only
 *  signal. `overdue` is derived: an assigned course past its due date. */
export const TRAINING_STATUS_META = {
  assigned: { label: "To do", color: "blue" },
  overdue: { label: "Overdue", color: "red" },
  submitted: { label: "Awaiting sign-off", color: "orange" },
  completed: { label: "Completed", color: "green" },
  cancelled: { label: "Cancelled", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
export type TrainingState = keyof typeof TRAINING_STATUS_META;

export const TRAINING_STATUSES = ["ASSIGNED", "SUBMITTED", "COMPLETED", "CANCELLED"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
export const OPEN_TRAINING_STATUSES: readonly TrainingStatus[] = ["ASSIGNED", "SUBMITTED"];

/** Where an assignment stands today. `on` is an ISO date (YYYY-MM-DD). */
export function trainingState(row: { status: string; dueOn: Date | null }, on: string): TrainingState {
  switch (row.status) {
    case "SUBMITTED": return "submitted";
    case "COMPLETED": return "completed";
    case "CANCELLED": return "cancelled";
    default: return row.dueOn && row.dueOn.toISOString().slice(0, 10) < on ? "overdue" : "assigned";
  }
}

/** Every Training capability. Holding any of them anywhere, with the Training
 *  screen, opens the Manage workspace; each page then scopes its records. */
export const TRAINING_CAPABILITIES = ["training.manage", "training.assign", "training.records.read", "training.signoff"] as const;

/** Days before expiry that a qualification counts as "expiring" (matches the
 *  People core's `qualificationState`). */
export const EXPIRY_WARNING_DAYS = 60;

/** `YYYY-MM-DD` plus whole months, clamped to the month's last day. */
export function addMonthsIso(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}
