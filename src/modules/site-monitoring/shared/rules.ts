import { CircleCheck, TriangleAlert } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** Site Monitoring's rules, pure. */

export const MONITORING_STATUSES = ["open", "closed"] as const;
export type MonitoringStatus = (typeof MONITORING_STATUSES)[number];

/** What an action shows. Tones come from here, never a call site. */
export const MONITORING_STATUS_META = {
  open: { label: "Needs action", color: "red", icon: TriangleAlert },
  closed: { label: "Closed", color: "green", icon: CircleCheck },
} as const satisfies Record<MonitoringStatus, StatusMeta>;

/** The reading in words: "Free chlorine 0.4 mg/L". */
export const readingLine = (a: { reading: string; value: string; unit: string }) => `${a.reading} ${a.value}${a.unit ? ` ${a.unit}` : ""}`;

/** The same reading announced twice raises one action. */
export const taskSourceKey = (taskId: string, key: string, value: string) => `tasks:${taskId}:${key}:${value}`;
