import {
  Activity,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  ClipboardCheck,
  Home,
  KeyRound,
  Layers,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import type { NavGroup, NavItem } from "@/components/ui-kit/app-shell";
import type { ScreenKey } from "@/lib/staff/screens";

/** What the sidebar offers. Only pages that exist belong here — a nav item
 *  pointing at a route nobody has built yet reads as a broken app.
 *
 *  `screen` ties the item to the screen catalogue: the item shows only for a
 *  role that names that screen and holds whatever it requires. That is
 *  courtesy, not security: the page declines to exist and the action
 *  refuses the call, and only the last of those three is load-bearing. */
export type AppNavItem = NavItem & {
  screen: ScreenKey;
  group: "daily" | "monitoring" | "setup";
};

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/today", label: "Today", icon: CalendarCheck, screen: "calendar", group: "daily" },
  { href: "/students", label: "Swimmers", icon: Users, screen: "students", group: "daily" },
  { href: "/courses", label: "Classes", icon: CalendarDays, screen: "courses", group: "daily" },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck, screen: "assessments", group: "daily" },
  { href: "/together", label: "Together", icon: CalendarHeart, screen: "together", group: "daily" },
  { href: "/", label: "Overview", icon: Home, screen: "overview", group: "monitoring" },
  { href: "/activity", label: "Activity", icon: Activity, screen: "activity", group: "monitoring" },
  { href: "/programmes", label: "Programmes", icon: Layers, screen: "programmes", group: "setup" },
  { href: "/staff", label: "Staff", icon: UserCog, screen: "staff", group: "setup" },
  { href: "/roles", label: "Roles", icon: KeyRound, screen: "roles", group: "setup" },
  // Which clubs exist. Which one you are in is the switcher above the nav.
  { href: "/clubs", label: "Clubs", icon: Building2, screen: "clubs", group: "setup" },
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
    { id: "setup", label: "Setup", icon: Settings, collapsible: true, items: items.filter(item => item.group === "setup") },
  ].filter(group => group.items.length > 0);
}

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

/** Search must land on a screen the person can actually open. */
export function swimmerLookupHref(screens: Set<ScreenKey>, id: string): string | null {
  if (screens.has("students")) return `/students/${encodeURIComponent(id)}`;
  return null;
}

/** Structural budgets only; data workspaces otherwise fill their region. */
export function pageWidthFor(pathname: string): number | undefined {
  if (pathname === "/account") return 768;
  if (pathname === "/together") return 960;
  if (pathname.startsWith("/programmes/")) return 1152;
  return undefined;
}
