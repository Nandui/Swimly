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

/** When a sub-activity is done while on an activity (owner, 20 October 2026: Till 1's "open the
 *  cash till" at the start, "close" at the end). The key is stored. */
export const SUB_WHEN = {
  start: "At the start",
  end: "At the end",
  at: "At a set time",
  during: "Any time while on it",
} as const;
export type SubWhen = keyof typeof SUB_WHEN;
export const SUB_WHENS = Object.keys(SUB_WHEN) as SubWhen[];

/** A location as an area and the detail after it ("Learner pool, lane 3"), kept with the lanes. */
export { joinLocation, splitLocation } from "@/lib/setup/lanes";
