import {
  ChartNoAxesCombined,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  ClipboardList,
  CalendarHeart,
  ClipboardCheck,
  Layers,
  UserRoundCheck,
  FileCheck2,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ScreenKey } from "@/lib/staff/screens";

/** What the Activities desk sidebar offers. Staff, Roles, Clubs and Activity
 *  are Core and live in the Core workspace (`src/app/(core)`), not here.
 *  Only pages that exist belong here — a nav item
 *  pointing at a route nobody has built yet reads as a broken app.
 *
 *  `screen` ties the item to the screen catalogue: the item shows only for a
 *  role that names that screen and holds whatever it requires. That is
 *  courtesy, not security: the page declines to exist and the action
 *  refuses the call, and only the last of those three is load-bearing. */
export type NavItem = { href: string; label: string; icon: LucideIcon; description?: string };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export type AppNavItem = NavItem & {
  /** One line on what the page is for, shown on the swim school overview. */
  description: string;
  screen: ScreenKey;
  group: "daily" | "monitoring" | "setup";
};

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/duty", label: "Duty manager", description: "Today's classes at a glance, and cancelling a session", icon: ClipboardList, screen: "duty", group: "daily" },
  { href: "/schedule", label: "Schedule", description: "Classes and assessments by day, with every pool area", icon: CalendarCheck, screen: "calendar", group: "daily" },
  { href: "/students", label: "Swimmers", description: "Find a swimmer, their family, progress and enrolment", icon: Users, screen: "students", group: "daily" },
  { href: "/courses", label: "Classes", description: "The weekly timetable: places, instructors and levels", icon: CalendarDays, screen: "courses", group: "daily" },
  { href: "/assessments", label: "Assessments", description: "Assessment sessions, bookings and placements", icon: ClipboardCheck, screen: "assessments", group: "daily" },
  { href: "/awaiting-enrolment", label: "Awaiting enrolment", description: "Swimmers ready for a class place, and family follow-ups", icon: UserRoundCheck, screen: "awaiting-enrolment", group: "daily" },
  { href: "/legend-agreements", label: "Legend agreements", description: "Billing agreements still to confirm for class places", icon: FileCheck2, screen: "legend-agreements", group: "daily" },
  { href: "/together", label: "Together", description: "A time that suits every child in one family", icon: CalendarHeart, screen: "together", group: "daily" },
  { href: "/analytics", label: "Analytics", description: "Enrolment, capacity and attendance reports", icon: ChartNoAxesCombined, screen: "analytics", group: "monitoring" },
  { href: "/cancellations", label: "Cancelled classes", description: "Cancelled sessions whose billing needs following up", icon: CalendarX2, screen: "cancellations", group: "monitoring" },
  { href: "/programmes", label: "Programmes", description: "Programmes, levels and competencies", icon: Layers, screen: "programmes", group: "setup" },
];

/** Takes the already-resolved set of screens this person can open, so the
 *  screen and permission rules are applied once by `visibleScreens` and
 *  this stays a plain membership test. */
export function visibleNavItems(screens: Set<ScreenKey>): AppNavItem[] {
  return NAV_ITEMS.filter((item) => screens.has(item.screen));
}

/** Filter first, then group: an empty group never advertises inaccessible work. */
export function visibleNavGroups(screens: Set<ScreenKey>): NavGroup[] {
  const items = visibleNavItems(screens);
  return [
    { id: "daily", label: "Daily work", items: items.filter(item => item.group === "daily") },
    { id: "monitoring", label: "Monitoring", items: items.filter(item => item.group === "monitoring") },
    { id: "setup", label: "Setup", items: items.filter(item => item.group === "setup") },
  ].filter(group => group.items.length > 0);
}

/** The daily-work pages this person can open, as plain links (no icons, so a server page can
 *  hand them to a client frame): the home page's page bar after Today. */
export function dailyPages(screens: Set<ScreenKey>): { href: string; label: string }[] {
  return visibleNavItems(screens).filter((item) => item.group === "daily").map(({ href, label }) => ({ href, label }));
}

export { isNavItemActive } from "@/lib/nav-active";

/** Search must land on a screen the person can actually open. */
export function swimmerLookupHref(screens: Set<ScreenKey>, id: string): string | null {
  if (screens.has("students")) return `/students/${encodeURIComponent(id)}`;
  return null;
}
