import { MonitorCheck, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

export const DEVICE_STATUS_META = {
  this: { label: "This browser", color: "blue", icon: MonitorCheck },
  revoked: { label: "Revoked", color: "gray", icon: XCircle },
} as const satisfies Record<string, StatusMeta>;
