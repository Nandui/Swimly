import type { StatusMeta } from "@/lib/status";
import type { ScopeKind } from "@/lib/policy/types";

/** Qualification status colours come from here, never from a call site. */
export const QUALIFICATION_STATE_META = {
  valid: { label: "Valid", color: "green" },
  expiring: { label: "Expires soon", color: "orange" },
  expired: { label: "Expired", color: "red" },
  revoked: { label: "Withdrawn", color: "gray" },
} as const satisfies Record<string, StatusMeta>;

/** Where an additional role applies, in the words the Staff page uses. */
export const SCOPE_META: Record<ScopeKind, { label: string; hint: string }> = {
  all: { label: "Everywhere", hint: "Every site and every person in the organisation." },
  site: { label: "One site", hint: "At that site, and for the people based there." },
  department: { label: "One department", hint: "For that department and its members." },
  reports: { label: "Their own team", hint: "For the people who report to them, directly or through their managers." },
};

/** Account-level markers on the person page. */
export const PERSON_STATUS_META = {
  superadmin: { label: "Superadmin", color: "purple" },
  deactivated: { label: "Deactivated", color: "gray" },
  restricted: { label: "Restricted", color: "purple" },
} as const satisfies Record<string, StatusMeta>;
