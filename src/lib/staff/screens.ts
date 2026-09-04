import type { PermissionKey } from "@/lib/staff/permissions";
import { ROLE_HOMES, expandPermissions } from "@/lib/staff/permissions";

/** Every screen the app has, and nothing else.
 *
 *  A role names the screens its holders may open, the way it names the
 *  permissions they hold. Permissions are the power to change something;
 *  screens are what is on offer at all. An instructor role can be given
 *  Today and nothing else, and then the deck is the whole app for them:
 *  the nav shows one item, and every other page declines to exist.
 *
 *  Like the permission catalogue this is code, not data: a screen exists
 *  because a page asks for it. Unknown keys stored on a role are ignored.
 *  The Account page is not in here — it is always reachable, because it is
 *  the one page where a person changes their own password.
 *
 *  `requires` is the permission the screen is pointless without. Today is
 *  the deck, so it needs the power to take attendance; Programmes is the
 *  curriculum editor, so it needs the power to edit it. Both the screen
 *  and the permission have to be held. */

export const SCREENS = [
  {
    key: "overview",
    label: "Overview",
    path: "/",
    description: "The numbers, today's classes and recent activity.",
  },
  {
    key: "today",
    label: "Today",
    path: "/today",
    description:
      "The deck: their classes today, attendance and competencies. Needs the permission to take attendance.",
    requires: "attendance.mark",
  },
  {
    key: "students",
    label: "Students",
    path: "/students",
    description: "Every swimmer, their profile, contacts and progress.",
  },
  {
    key: "courses",
    label: "Courses",
    path: "/courses",
    description: "The timetable, each class's page, and registers weeks back.",
  },
  {
    key: "together",
    label: "Together",
    path: "/together",
    description: "A time that suits every child in one family.",
  },
  {
    key: "assessments",
    label: "Assessments",
    path: "/assessments",
    description: "Swim School Assessment sessions, bookings and placements.",
  },
  {
    key: "programmes",
    label: "Programmes",
    path: "/programmes",
    description: "The curriculum. Needs the permission to edit it.",
    requires: "curriculum.manage",
  },
  {
    key: "staff",
    label: "Staff",
    path: "/staff",
    description: "Staff accounts. Needs the permission to manage them.",
    requires: "staff.manage",
  },
  {
    key: "roles",
    label: "Roles",
    path: "/roles",
    description: "These roles. Needs the permission to manage them.",
    requires: "roles.manage",
  },
  {
    key: "clubs",
    label: "Clubs",
    path: "/clubs",
    description: "Which sites exist. Needs the permission to manage them.",
    requires: "clubs.manage",
  },
  {
    key: "activity",
    label: "Activity",
    path: "/activity",
    description: "The log of every change. Needs the permission to read it.",
    requires: "activity.view",
  },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  description: string;
  requires?: PermissionKey;
}[];

export type ScreenKey = (typeof SCREENS)[number]["key"];

const ALL_KEYS = new Set<string>(SCREENS.map((s) => s.key));

export const ALL_SCREENS: ScreenKey[] = SCREENS.map((s) => s.key);

export function isScreenKey(value: unknown): value is ScreenKey {
  return typeof value === "string" && ALL_KEYS.has(value);
}

export function screenMeta(key: ScreenKey) {
  return SCREENS.find((s) => s.key === key)!;
}

/** Keys filtered against the catalogue, in catalogue order, no duplicates. */
export function cleanScreens(input: readonly string[]): ScreenKey[] {
  const held = new Set(input.filter(isScreenKey));
  return ALL_SCREENS.filter((key) => held.has(key));
}

/** The screens a person can actually open: the ones their role names, minus
 *  any whose required permission they do not hold. */
export function visibleScreens(
  screens: readonly string[],
  permissions: Set<PermissionKey>
): Set<ScreenKey> {
  const out = new Set<ScreenKey>();
  for (const screen of SCREENS) {
    if (!screens.includes(screen.key)) continue;
    if ("requires" in screen && screen.requires && !permissions.has(screen.requires)) continue;
    out.add(screen.key);
  }
  return out;
}

/** The path a role starts on: Today if that is the choice and they can open
 *  it, otherwise the overview, otherwise the first screen they can open, so
 *  nobody signs in to a 404. Account is the floor — everyone has that. */
export function homePathFor(
  home: string,
  permissions: readonly string[],
  screens: readonly string[]
): string {
  const visible = visibleScreens(screens, expandPermissions(permissions));
  if (home === "today" && visible.has("today")) return ROLE_HOMES.today.path;
  if (visible.has("overview")) return ROLE_HOMES.overview.path;
  const first = SCREENS.find((screen) => visible.has(screen.key));
  return first ? first.path : "/account";
}
