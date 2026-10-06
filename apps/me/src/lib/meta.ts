import { ArrowRightLeft, Ban, CalendarClock, CircleCheck, CircleDot, Clock3, Coffee, CopyX, FileQuestion, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";

/** Status words, tones and icons: from here only, never chosen at a call site.
 *  Every tone has its own icon, so colour is never the only signal. The icons match Work's
 *  maps (TRAINING_STATUS_META, QUALIFICATION_STATE_META, REVIEW_STATUS_META, ROTA_FIT_META). */
export type Tone = "green" | "orange" | "red" | "blue" | "gray";
export type Meta = { label: string; tone: Tone; icon: LucideIcon };

export const TRAINING_META: Record<string, Meta> = {
  assigned: { label: "To do", tone: "blue", icon: CircleDot },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  submitted: { label: "Awaiting sign-off", tone: "orange", icon: Clock3 },
  completed: { label: "Completed", tone: "green", icon: CircleCheck },
  cancelled: { label: "Cancelled", tone: "gray", icon: XCircle },
};

export const QUALIFICATION_META: Record<string, Meta> = {
  valid: { label: "Valid", tone: "green", icon: CircleCheck },
  expiring: { label: "Expires soon", tone: "orange", icon: CalendarClock },
  expired: { label: "Expired", tone: "red", icon: TriangleAlert },
  revoked: { label: "Withdrawn", tone: "gray", icon: Ban },
};

export const UPLOAD_META: Record<string, Meta> = {
  PENDING: { label: "Being checked", tone: "orange", icon: Clock3 },
  VERIFIED: { label: "Recorded", tone: "green", icon: CircleCheck },
  DECLINED: { label: "Not accepted", tone: "gray", icon: XCircle },
};

export const READING_META: Record<string, Meta> = {
  outstanding: { label: "To read", tone: "blue", icon: CircleDot },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  completed: { label: "Read", tone: "green", icon: CircleCheck },
};

export const REVIEW_META: Record<string, Meta> = {
  shared: { label: "To acknowledge", tone: "orange", icon: Clock3 },
  acknowledged: { label: "Acknowledged", tone: "green", icon: CircleCheck },
};

export const SHIFT_WARNING_META: Record<string, Meta> = {
  expired: { label: "Qualification expired", tone: "red", icon: TriangleAlert },
  missing: { label: "Qualification not recorded", tone: "orange", icon: FileQuestion },
  overlap: { label: "Double-booked", tone: "orange", icon: CopyX },
};

/** A day on the rota: changed since it was shared, or breaks still to arrange. */
export const DAY_META: Record<string, Meta> = {
  changed: { label: "Changed", tone: "blue", icon: ArrowRightLeft },
  breaks: { label: "Breaks to arrange", tone: "orange", icon: Coffee },
};

export const REVIEW_OVERALL: Record<string, string> = {
  exceeds: "Exceeds expectations",
  meets: "Meets expectations",
  developing: "Still developing",
};
