import { Activity, ConciergeBell, Dumbbell, GraduationCap, LifeBuoy, SprayCan, Waves, Wrench, type LucideIcon } from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** The shared setup's words and icons (docs/admin-setup.md). A plain module, so
 *  server and client both read it, and every module shows an activity the same way. */

/** The icons an activity on the organisation's list may take. The key is stored. */
export const ACTIVITY_ICONS = {
  lifeguard: { label: "Lifeguard", icon: LifeBuoy },
  teaching: { label: "Teaching", icon: GraduationCap },
  reception: { label: "Reception", icon: ConciergeBell },
  poolside: { label: "Poolside", icon: Waves },
  gym: { label: "Gym", icon: Dumbbell },
  cleaning: { label: "Cleaning", icon: SprayCan },
  maintenance: { label: "Maintenance", icon: Wrench },
  activity: { label: "Other", icon: Activity },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;
export type ActivityIconKey = keyof typeof ACTIVITY_ICONS;
export const ACTIVITY_ICON_KEYS = Object.keys(ACTIVITY_ICONS) as ActivityIconKey[];
export function activityIcon(key: string): LucideIcon {
  return (ACTIVITY_ICONS as Record<string, { icon: LucideIcon }>)[key]?.icon ?? Activity;
}

/** An activity that used to take the swim classes: the classes now fill the Plan by themselves,
 *  so it is not offered there. Saving it makes it an ordinary activity. */
export const ACTIVITY_TAG_META = {
  classes: { label: "Not on the Plan: swim classes fill it by themselves", color: "gray", icon: GraduationCap },
} as const satisfies Record<string, StatusMeta>;

/** "Learner pool, lane 3" → the area and the detail after it, when the text starts with an area. */
export function splitLocation(value: string | null | undefined, areas: readonly string[]): { area: string; detail: string } {
  const text = (value ?? "").trim();
  if (!text) return { area: "", detail: "" };
  const lower = text.toLowerCase();
  const area = [...areas].sort((a, b) => b.length - a.length).find((a) => lower === a.toLowerCase() || lower.startsWith(`${a.toLowerCase()},`));
  if (!area) return { area: "", detail: text };
  return { area, detail: text.slice(area.length).replace(/^,\s*/, "") };
}

/** The area and its detail as one location: "Learner pool, lane 3". */
export function joinLocation(area: string, detail: string) {
  return [area.trim(), detail.trim()].filter(Boolean).join(", ");
}
