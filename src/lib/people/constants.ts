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

/** How someone is employed (owner decision, 8 October 2026), on their Staff page. */
export const CONTRACT_META = {
  "full-time": { label: "Full-time" },
  "part-time": { label: "Part-time" },
  casual: { label: "Casual" },
  seasonal: { label: "Seasonal" },
} as const;
export type ContractType = keyof typeof CONTRACT_META;
export const CONTRACT_TYPES = Object.keys(CONTRACT_META) as ContractType[];
/** 2250 minutes → "37.5". */
export const hoursOf = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100);
