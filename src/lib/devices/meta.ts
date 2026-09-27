import type { StatusMeta } from "@/lib/status";

export const DEVICE_STATUS_META = {
  this: { label: "This browser", color: "blue" },
  revoked: { label: "Revoked", color: "gray" },
} as const satisfies Record<string, StatusMeta>;
