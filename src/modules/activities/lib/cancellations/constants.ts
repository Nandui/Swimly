import type { TagColor } from "@/components/ui-kit/tag";

export const CANCELLATION_META = {
  cancelled: { label: "Cancelled", color: "red" },
  pending: { label: "Awaiting billing", color: "orange" },
  notified: { label: "Billing notified", color: "green" },
} as const satisfies Record<string, { label: string; color: TagColor }>;

export const CANCELLED_SESSION_ERROR = "This session has been cancelled. No further teaching records can be saved for it.";
