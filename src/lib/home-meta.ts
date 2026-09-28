import type { StatusMeta } from "@/lib/status";

/** How a home card marks a line that waits for this person. */
export const HOME_ITEM_META = {
  attention: { label: "Needs you", color: "yellow" },
} as const satisfies Record<string, StatusMeta>;
