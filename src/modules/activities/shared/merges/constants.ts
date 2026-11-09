import { Merge } from "lucide-react";
import type { StatusMeta } from "@/lib/status";
import { formatTime } from "@/lib/format";

export const MERGE_META = {
  away: { label: "Merged", color: "purple", icon: Merge },
  host: { label: "Joined class", color: "blue", icon: Merge },
} as const satisfies Record<string, StatusMeta>;

/** What a merged-away class says wherever it can no longer be started or marked. */
export function mergedAwayMessage(merge: { intoClassName: string; intoStartMinutes: number }) {
  return `This class was merged into ${merge.intoClassName} at ${formatTime(merge.intoStartMinutes)} for today. Take its swimmers’ attendance on that class.`;
}
