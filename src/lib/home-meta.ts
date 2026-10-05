import { CircleCheck, ClipboardCheck, Clock3, Play, TriangleAlert, XCircle } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** How the home page and overviews mark a line or figure that waits for this person (the
 *  figure's reason replaces the words), and a page where nothing does. */
export const HOME_ITEM_META = {
  attention: { label: "Needs you", color: "orange", icon: TriangleAlert },
  clear: { label: "All clear", color: "gray", icon: CircleCheck },
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
