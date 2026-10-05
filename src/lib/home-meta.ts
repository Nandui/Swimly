import { CircleCheck, ClipboardCheck, Clock3, Play, TriangleAlert, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** How a home card marks a line that waits for this person. */
export const HOME_ITEM_META = {
  attention: { label: "Needs you", color: "orange", icon: TriangleAlert },
} as const satisfies Record<string, StatusMeta>;

/** Each block on the home timeline: its label, tone and icon. The timeline blocks show the icon
 *  alone, so every state has its own and colour is never the only signal. */
export const HOME_SESSION_META = {
  done: { label: "Finished", color: "gray", icon: CircleCheck },
  now: { label: "On now", color: "green", icon: Play },
  next: { label: "Coming up", color: "blue", icon: Clock3 },
  cover: { label: "Cover needed", color: "orange", icon: TriangleAlert },
  off: { label: "Cancelled", color: "red", icon: XCircle },
  assessment: { label: "Assessment", color: "purple", icon: ClipboardCheck },
} as const satisfies Record<string, StatusMeta>;
