import { Ban, CalendarClock, CircleCheck, CirclePause, ShieldCheck, ShieldHalf, TriangleAlert } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Qualification status tone and icon come from here, never from a call site. */
export const QUALIFICATION_STATE_META = {
  valid: { label: "Valid", color: "green", icon: CircleCheck },
  expiring: { label: "Expires soon", color: "orange", icon: CalendarClock },
  expired: { label: "Expired", color: "red", icon: TriangleAlert },
  revoked: { label: "Withdrawn", color: "gray", icon: Ban },
} as const satisfies Record<string, StatusMeta>;

/** Account-level markers on the person page. */
export const PERSON_STATUS_META = {
  superadmin: { label: "Superadmin", color: "purple", icon: ShieldCheck },
  deactivated: { label: "Deactivated", color: "gray", icon: CirclePause },
  restricted: { label: "Restricted", color: "purple", icon: ShieldHalf },
} as const satisfies Record<string, StatusMeta>;
