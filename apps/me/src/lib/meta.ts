import { Ban, Check, CircleDot, CopyX, FileQuestion, Hourglass, TriangleAlert, type LucideIcon } from "lucide-react";

/** Status words, tones and icons: from here only, never chosen at a call site.
 *  Every tone has its own icon, so colour is never the only signal. */
export type Tone = "green" | "orange" | "red" | "blue" | "gray";
export type Meta = { label: string; tone: Tone; icon: LucideIcon };

export const TRAINING_META: Record<string, Meta> = {
  assigned: { label: "To do", tone: "blue", icon: CircleDot },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  submitted: { label: "Awaiting sign-off", tone: "orange", icon: Hourglass },
  completed: { label: "Completed", tone: "green", icon: Check },
  cancelled: { label: "Cancelled", tone: "gray", icon: Ban },
};

export const QUALIFICATION_META: Record<string, Meta> = {
  valid: { label: "Valid", tone: "green", icon: Check },
  expiring: { label: "Expires soon", tone: "orange", icon: Hourglass },
  expired: { label: "Expired", tone: "red", icon: TriangleAlert },
  revoked: { label: "Withdrawn", tone: "gray", icon: Ban },
};

export const UPLOAD_META: Record<string, Meta> = {
  PENDING: { label: "Being checked", tone: "orange", icon: Hourglass },
  VERIFIED: { label: "Recorded", tone: "green", icon: Check },
  DECLINED: { label: "Not accepted", tone: "gray", icon: Ban },
};

export const READING_META: Record<string, Meta> = {
  outstanding: { label: "To read", tone: "blue", icon: CircleDot },
  overdue: { label: "Overdue", tone: "red", icon: TriangleAlert },
  completed: { label: "Read", tone: "green", icon: Check },
};

export const REVIEW_META: Record<string, Meta> = {
  shared: { label: "To acknowledge", tone: "orange", icon: Hourglass },
  acknowledged: { label: "Acknowledged", tone: "green", icon: Check },
};

export const SHIFT_WARNING_META: Record<string, Meta> = {
  expired: { label: "Qualification expired", tone: "red", icon: TriangleAlert },
  missing: { label: "Qualification not recorded", tone: "orange", icon: FileQuestion },
  overlap: { label: "Double-booked", tone: "orange", icon: CopyX },
};

export const REVIEW_OVERALL: Record<string, string> = {
  exceeds: "Exceeds expectations",
  meets: "Meets expectations",
  developing: "Still developing",
};
