import {
  Activity, Ban, CalendarCheck, CircleCheck, Clock3, Coffee, ConciergeBell, CopyX, Dumbbell, FileQuestion, GraduationCap, LifeBuoy,
  Pencil, Send, SprayCan, TriangleAlert, Waves, Wrench, type LucideIcon,
} from "lucide-react";
import type { StatusMeta } from "@/lib/status";

/** The rebuilt rota's words, tones and icons (owner decisions, 6 October 2026). Every status on
 *  a Rota screen comes from a map here, with its icon, so colour is never the only signal. A plain
 *  module, so server and client both read it. */

/** The icons an activity on the organisation's list may take. The key is stored. */
export const ROTA_ACTIVITY_ICONS = {
  lifeguard: { label: "Lifeguard", icon: LifeBuoy },
  teaching: { label: "Teaching", icon: GraduationCap },
  reception: { label: "Reception", icon: ConciergeBell },
  poolside: { label: "Poolside", icon: Waves },
  gym: { label: "Gym", icon: Dumbbell },
  cleaning: { label: "Cleaning", icon: SprayCan },
  maintenance: { label: "Maintenance", icon: Wrench },
  activity: { label: "Other", icon: Activity },
} as const satisfies Record<string, { label: string; icon: LucideIcon }>;
export type RotaActivityIcon = keyof typeof ROTA_ACTIVITY_ICONS;
export const ROTA_ACTIVITY_ICON_KEYS = Object.keys(ROTA_ACTIVITY_ICONS) as RotaActivityIcon[];
export function activityIcon(key: string): LucideIcon {
  return (ROTA_ACTIVITY_ICONS as Record<string, { icon: LucideIcon }>)[key]?.icon ?? Activity;
}

/** Where a day stands on the week strip and the day's head. */
export const ROTA_DAY_META = {
  covered: { label: "Covered", color: "green", icon: CircleCheck },
  gaps: { label: "Gaps", color: "orange", icon: TriangleAlert },
  empty: { label: "Nothing planned", color: "gray", icon: Pencil },
} as const satisfies Record<string, StatusMeta>;

/** A department's week: a draft until the supervisor shares it with their staff. */
export const ROTA_WEEK_META = {
  draft: { label: "Draft", color: "gray", icon: Pencil },
  shared: { label: "Shared", color: "green", icon: Send },
} as const satisfies Record<string, StatusMeta>;

/** Why someone sits where they do on "Who can fill it". None of these stops anyone being put on. */
export const ROTA_FIT_META = {
  good: { label: "Good fit", color: "green", icon: CircleCheck },
  long: { label: "Long day", color: "orange", icon: Clock3 },
  overlap: { label: "Double-booked", color: "orange", icon: CopyX },
  missing: { label: "Qualification not recorded", color: "orange", icon: FileQuestion },
  expired: { label: "Qualification expired", color: "red", icon: TriangleAlert },
  off: { label: "Off", color: "gray", icon: Ban },
} as const satisfies Record<string, StatusMeta>;
export type RotaFitKey = keyof typeof ROTA_FIT_META;

/** What a person's worked-out shift says about their day. */
export const ROTA_SHIFT_NOTE_META = {
  break: { label: "Break", color: "gray", icon: Coffee },
  noBreak: { label: "No room for a break", color: "orange", icon: Coffee },
  twoParts: { label: "Two parts", color: "gray", icon: Clock3 },
} as const satisfies Record<string, StatusMeta>;

/** A change to a live day, against Timepoint. */
export const ROTA_TIMEPOINT_META = {
  todo: { label: "Update Timepoint", color: "orange", icon: Clock3 },
  done: { label: "Updated in Timepoint", color: "green", icon: CircleCheck },
} as const satisfies Record<string, StatusMeta>;

/** A swim class on the rota: planned from the rota, or the class's usual instructor. */
export const ROTA_CLASS_META = {
  usual: { label: "Usual instructor", color: "gray", icon: GraduationCap },
  planned: { label: "Planned on the rota", color: "blue", icon: CalendarCheck },
} as const satisfies Record<string, StatusMeta>;

/** A qualification in short: the trailing "(NPLQ)" of "National Pool Lifeguard Qualification
 *  (NPLQ)" when the name has one, else the name. */
export function qualificationShort(name: string) {
  return /\(([^()]+)\)\s*$/.exec(name)?.[1]?.trim() || name;
}
