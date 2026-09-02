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
import type { PermissionKey } from "@/lib/staff/permissions";

/** What the sidebar offers. Only pages that exist belong here — a nav item
 *  pointing at a route nobody has built yet reads as a broken app.
 *
 *  `requires` hides an item from people who cannot reach it. That is
 *  courtesy, not security: the page hides the button and the action refuses
 *  the call, and only the last of those three is load-bearing. */
export type AppNavItem = NavItem & { requires?: PermissionKey };

export const NAV_ITEMS: AppNavItem[] = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/today", label: "Today", icon: CalendarCheck, requires: "attendance.mark" },
  { href: "/students", label: "Students", icon: Users },
  { href: "/courses", label: "Courses", icon: CalendarDays },
  // No `requires`: it only reads, and the desk staff who field "can all three
  // come at the same time?" are exactly who needs it.
  { href: "/together", label: "Together", icon: CalendarHeart },
  // Reads are open; booking, running and placing each ask for their own
  // permission on the page.
  { href: "/assessments", label: "Assessments", icon: ClipboardCheck },
  { href: "/programmes", label: "Programmes", icon: Layers, requires: "curriculum.manage" },
  { href: "/staff", label: "Staff", icon: UserCog, requires: "staff.manage" },
  { href: "/roles", label: "Roles", icon: KeyRound, requires: "roles.manage" },
  // Which clubs exist. Which one you are in is the switcher above the nav.
  { href: "/clubs", label: "Clubs", icon: Building2, requires: "clubs.manage" },
  { href: "/activity", label: "Activity", icon: Activity, requires: "activity.view" },
  // Last, and open to everyone: it is the one page a read-only account can
  // write from, and the only way an admin-set password stops being one the
  // admin knows.
  { href: "/account", label: "Account", icon: CircleUser },
];

/** Takes the already-expanded permission set rather than the session, so the
 *  implication rules are applied once by `permissionsOf` and this stays a
 *  plain membership test. */
export function visibleNavItems(permissions: Set<PermissionKey>): AppNavItem[] {
  return NAV_ITEMS.filter((item) => !item.requires || permissions.has(item.requires));
}
