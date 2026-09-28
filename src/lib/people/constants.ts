import type { StatusMeta } from "@/lib/status";

/** Qualification status colours come from here, never from a call site. */
export const QUALIFICATION_STATE_META = {
  valid: { label: "Valid", color: "green" },
  expiring: { label: "Expires soon", color: "orange" },
  expired: { label: "Expired", color: "red" },
  revoked: { label: "Withdrawn", color: "gray" },
} as const satisfies Record<string, StatusMeta>;

/** Account-level markers on the person page. */
export const PERSON_STATUS_META = {
  superadmin: { label: "Superadmin", color: "purple" },
  deactivated: { label: "Deactivated", color: "gray" },
  restricted: { label: "Restricted", color: "purple" },
} as const satisfies Record<string, StatusMeta>;
