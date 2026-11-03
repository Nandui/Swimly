import { CircleCheck, Clock3, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** A certificate staff uploaded in Turnfin Me, on its way to their record. */
export const CERTIFICATE_STATUS_META = {
  PENDING: { label: "Waiting to be checked", color: "orange", icon: Clock3 },
  VERIFIED: { label: "Recorded", color: "green", icon: CircleCheck },
  DECLINED: { label: "Declined", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;

/** Days before expiry that a qualification counts as "expiring" (matches the
 *  People core's `qualificationState`). */
export const EXPIRY_WARNING_DAYS = 60;

/** Qualifications' dialogs carry the module scope into their portal. */
export const THEME = "turnfin-module";
