import {
  Activity,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarHeart,
  ClipboardCheck,
  CircleUser,
  Home,
  KeyRound,
  Layers,
  UserCog,
  Users,
} from "lucide-react";
import type { NavItem } from "@/components/ui-kit/app-shell";
import type { ScreenKey } from "@/lib/staff/screens";

/** What the sidebar offers. Only pages that exist belong here — a nav item
 *  pointing at a route nobody has built yet reads as a broken app.
 *
 *  `screen` ties the item to the screen catalogue: the item shows only for a
 *  role that names that screen and holds whatever it requires. That is
 *  courtesy, not security: the page declines to exist and the action
 *  refuses the call, and only the last of those three is load-bearing. */
export type AppNavItem = NavItem & { screen?: ScreenKey };

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/", label: "Overview", icon: Home, screen: "overview" },
  { href: "/today", label: "Today", icon: CalendarCheck, screen: "today" },
  { href: "/students", label: "Swimmers", icon: Users, screen: "students" },
  { href: "/courses", label: "Classes", icon: CalendarDays, screen: "courses" },
  { href: "/together", label: "Together", icon: CalendarHeart, screen: "together" },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck, screen: "assessments" },
  { href: "/programmes", label: "Programmes", icon: Layers, screen: "programmes" },
  { href: "/staff", label: "Staff", icon: UserCog, screen: "staff" },
  { href: "/roles", label: "Roles", icon: KeyRound, screen: "roles" },
  // Which clubs exist. Which one you are in is the switcher above the nav.
  { href: "/clubs", label: "Clubs", icon: Building2, screen: "clubs" },
  { href: "/activity", label: "Activity", icon: Activity, screen: "activity" },
  // Last, and open to everyone: it is the one page a read-only account can
  // write from, and the only way an admin-set password stops being one the
  // admin knows.
  { href: "/account", label: "Account", icon: CircleUser },
];

/** Takes the already-resolved set of screens this person can open, so the
 *  screen and permission rules are applied once by `visibleScreens` and
 *  this stays a plain membership test. */
export function visibleNavItems(screens: Set<ScreenKey>): AppNavItem[] {
  return NAV_ITEMS.filter((item) => !item.screen || screens.has(item.screen));
}
