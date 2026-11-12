import { BadgeCheck, CircleCheck, RotateCcw, TriangleAlert, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

export const CANCELLATION_META = {
  cancelled: { label: "Cancelled", color: "red", icon: XCircle },
  pending: { label: "Awaiting billing", color: "orange", icon: TriangleAlert },
  notified: { label: "Billing notified", color: "green", icon: CircleCheck },
  restore: { label: "To restore", color: "blue", icon: RotateCcw },
  restored: { label: "Restored", color: "green", icon: BadgeCheck },
} as const satisfies Record<string, StatusMeta>;

export const CANCELLED_SESSION_ERROR = "This session has been cancelled. No further teaching records can be saved for it.";
