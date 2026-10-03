import type { StatusMeta } from "@/lib/status";

/** How a home card marks a line that waits for this person. */
export const HOME_ITEM_META = {
  attention: { label: "Needs you", color: "yellow" },
} as const satisfies Record<string, StatusMeta>;

/** Each block on the home timeline: its label, and the tone it is drawn in. Every state also has
 *  its own icon (home-parts), so colour is never the only signal. */
export const HOME_SESSION_META = {
  done: { label: "Finished", color: "gray" },
  now: { label: "On now", color: "green" },
  next: { label: "Coming up", color: "blue" },
  cover: { label: "Cover needed", color: "yellow" },
  off: { label: "Cancelled", color: "red" },
  assessment: { label: "Assessment", color: "purple" },
} as const satisfies Record<string, StatusMeta>;
