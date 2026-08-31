import {
  Activity,
  CalendarCheck,
  CalendarDays,
  CircleUser,
  Home,
  Layers,
  UserCog,
  Users,
} from "lucide-react";
import type { NavItem } from "@/components/ui-kit/app-shell";
import type { PermissionTier } from "@/lib/authz";

/** What the sidebar offers. Only pages that exist belong here — a nav item
 *  pointing at a route nobody has built yet reads as a broken app.
 *
 *  `requires` hides an item from people who cannot reach it. That is
 *  courtesy, not security: the page hides the button and the action refuses
 *  the call, and only the last of those three is load-bearing. */
export type AppNavItem = NavItem & { requires?: PermissionTier };

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/today", label: "Today", icon: CalendarCheck, requires: "manage" },
  { href: "/students", label: "Students", icon: Users },
  { href: "/courses", label: "Courses", icon: CalendarDays },
  { href: "/programmes", label: "Programmes", icon: Layers, requires: "admin" },
  { href: "/staff", label: "Staff", icon: UserCog, requires: "admin" },
  { href: "/activity", label: "Activity", icon: Activity, requires: "admin" },
  // Last, and open to every tier: it is the one page a viewer can write from,
  // and the only way an admin-set password stops being one the admin knows.
  { href: "/account", label: "Account", icon: CircleUser },
];

export function visibleNavItems(tier: PermissionTier): AppNavItem[] {
  const rank: Record<PermissionTier, number> = { view: 0, manage: 1, admin: 2 };
  return NAV_ITEMS.filter((item) => !item.requires || rank[tier] >= rank[item.requires]);
}
