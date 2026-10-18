import { CircleCheck, CircleDashed, CircleDot, CircleMinus, CirclePause, Clock3, Hourglass, PencilLine, TriangleAlert, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Training status tone and icon come from here, never from a call site.
 *  `overdue` is derived: an assigned course past its due date. */
export const TRAINING_STATUS_META = {
  assigned: { label: "To do", color: "blue", icon: CircleDot },
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
  submitted: { label: "Awaiting sign-off", color: "orange", icon: Clock3 },
  completed: { label: "Completed", color: "green", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;
export type TrainingState = keyof typeof TRAINING_STATUS_META;

/** A certificate staff uploaded in Turnfin Me, on its way to their record. */
export const CERTIFICATE_STATUS_META = {
  PENDING: { label: "Waiting to be checked", color: "orange", icon: Clock3 },
  VERIFIED: { label: "Recorded", color: "green", icon: CircleCheck },
  DECLINED: { label: "Declined", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;

/** A classroom or poolside session (phase 5). */
export const SESSION_STATUS_META = {
  upcoming: { label: "Coming up", color: "blue", icon: CircleDot },
  register: { label: "Register to close", color: "orange", icon: Clock3 },
  closed: { label: "Register closed", color: "green", icon: CircleCheck },
  cancelled: { label: "Cancelled", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;

/** One person's place on a session. */
export const PLACE_STATUS_META = {
  BOOKED: { label: "Booked", color: "blue", icon: CircleDot },
  ATTENDED: { label: "Attended", color: "green", icon: CircleCheck },
  ABSENT: { label: "Absent", color: "red", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;

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

/** Where a course's lessons stand in the builder (e-learning, phase 1). */
export const COURSE_DRAFT_META = {
  draft: { label: "Draft", color: "gray", icon: PencilLine },
  changed: { label: "Changes not published", color: "orange", icon: PencilLine },
  published: { label: "Published", color: "green", icon: CircleCheck },
} as const satisfies Record<string, StatusMeta>;

/** Where someone stands on a course a training rule needs (the matrix, e-learning phase 4). */
export const MATRIX_CELL_META = {
  done: { label: "Done", color: "green", icon: CircleCheck },
  soon: { label: "Due again soon", color: "orange", icon: Hourglass },
  due: { label: "To do", color: "blue", icon: CircleDot },
  submitted: { label: "Awaiting sign-off", color: "orange", icon: Clock3 },
  overdue: { label: "Overdue", color: "red", icon: TriangleAlert },
  expired: { label: "Out of date", color: "red", icon: TriangleAlert },
  missing: { label: "Not assigned yet", color: "gray", icon: CircleDashed },
  excused: { label: "Excused", color: "gray", icon: CircleMinus },
} as const satisfies Record<string, StatusMeta>;

/** A training rule's state. */
export const RULE_STATE_META = {
  running: { label: "Running", color: "green", icon: CircleCheck },
  paused: { label: "Paused", color: "gray", icon: CirclePause },
  waiting: { label: "Waits for the course to be published", color: "orange", icon: Clock3 },
} as const satisfies Record<string, StatusMeta>;
