import type { PermissionKey } from "@/lib/staff/permissions";
import { ROLE_HOMES, expandPermissions, hasAdministratorAccess, isRestrictedPermission } from "@/lib/staff/permissions";

/** Every screen the app has, and nothing else.
 *
 *  A role names the screens its holders may open, the way it names the
 *  permissions they hold. Permissions are the power to change something;
 *  screens are what is on offer at all. An instructor role can be given
 *  Instructor and nothing else, and then the deck is the whole app for them:
 *  the nav shows one item, and every other page declines to exist.
 *
 *  Like the permission catalogue this is code, not data: a screen exists
 *  because a page asks for it. Unknown keys stored on a role are ignored.
 *  The Account page is not in here — it is always reachable, because it is
 *  the one page where a person changes their own password.
 *
 *  `requires` is the permission the screen is pointless without. Programmes
 *  needs curriculum editing. Today is a read-only calendar; opening attendance
 *  from it still requires the separate attendance permission. */

export const SCREENS = [
  { key: "refunds", label: "Refunds", path: "/refunds", description: "A separate workspace for customer refund requests, finance decisions and external payment records.", requires: "refunds.read" },
  {
    key: "analytics",
    label: "Analytics",
    path: "/analytics",
    description: "Enrolled swimmers by level, recent enrolment activity and monthly class cancellations for the selected site.",
  },
  {
    key: "duty",
    label: "Duty manager",
    path: "/duty",
    description: "Today’s classes and quick details. Cancelling a session requires its separate permission.",
  },
  {
    key: "cancellations",
    label: "Cancelled classes",
    path: "/cancellations",
    description: "Cancelled sessions and affected swimmers awaiting billing follow-up, with notification history.",
  },
  {
    key: "calendar",
    label: "Schedule",
    path: "/schedule",
    description:
      "Classes and assessments one day at a time, with a seven-day week navigator, instructors and available places.",
  },
  {
    key: "instructor",
    label: "Instructor",
    path: "/instructor",
    description: "A separate tablet workspace for instructors: own classes, cover, attendance, competencies and today's assessments. Not shown in the desk navigation.",
    requires: "attendance.mark",
  },
  {
    key: "students",
    label: "Swimmers",
    path: "/students",
    description: "Every swimmer, their profile, contacts and progress.",
  },
  {
    key: "courses",
    label: "Classes",
    path: "/courses",
    description: "The timetable, each class, and attendance from weeks back.",
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
    description: "Upcoming assessment rosters and session setup.",
  },
  {
    key: "awaiting-enrolment",
    label: "Awaiting enrolment",
    path: "/awaiting-enrolment",
    description: "Assessed swimmers awaiting a class and all class waitlists at the selected site. Enrolling requires its separate permission.",
  },
  {
    key: "legend-agreements",
    label: "Legend agreements",
    path: "/legend-agreements",
    description: "Active class places with outstanding Legend billing agreements, including existing enrolments that need checking. Confirming requires enrolment permission.",
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
  { key: "training", label: "Training", path: "/training", description: "A separate workspace for the training catalogue, assigning courses, trainer sign-off and expiring qualifications. Everyone completes their own training in Turnfin Me without it.", requires: "training.records.read" },
  { key: "rota", label: "Rota", path: "/rota", description: "A separate workspace for the week's shifts at a site, with warnings when someone's qualification has expired. Staff see their own shifts in Turnfin Me.", requires: "rota.view" },
  { key: "hr", label: "HR and performance", path: "/hr", description: "A separate, restricted workspace for HR notes and performance reviews of the people a role covers. Staff read what is shared with them in Turnfin Me.", requires: "hr.records.read" },
  { key: "docs", label: "Docs", path: "/docs", description: "A separate workspace for documents, independent approvals and required reading.", requires: "docs.read" },
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
  // Existing roles stored "today" for the deck. Resolve that retired key
  // without giving deck-only roles the desk calendar. Legacy roles that
  // already offered desk screens retain their existing Today calendar.
  // New roles use the two independent explicit keys.
  // The retired Overview key still identifies a legacy desk role when
  // resolving its old Today grant; it never becomes a screen itself.
  const hadDeskScreens = input.some(key => key === "overview" || (isScreenKey(key) && isAquaticsScreen(key) && key !== "instructor"));
  const held = new Set(input.flatMap(key => key === "today"
    ? hadDeskScreens ? ["calendar", "instructor"] : ["instructor"]
    : [key]).filter(isScreenKey));
  return ALL_SCREENS.filter((key) => held.has(key));
}

/** Administrators receive the whole catalogue, including future screens —
 *  except a screen whose required permission is restricted (HR), which follows
 *  the permission: administrators do not hold it, superadmins do.
 *  Other roles need an explicit screen grant and its required permission. */
export function visibleScreens(
  screens: readonly string[],
  permissions: Set<PermissionKey>
): Set<ScreenKey> {
  if (hasAdministratorAccess(permissions)) {
    return new Set(SCREENS.filter((screen) => !("requires" in screen && screen.requires) || permissions.has(screen.requires)).map((screen) => screen.key));
  }
  const out = new Set<ScreenKey>();
  const held = new Set(cleanScreens(screens));
  for (const screen of SCREENS) {
    if (!held.has(screen.key)) continue;
    if ("requires" in screen && screen.requires && !permissions.has(screen.requires)) continue;
    out.add(screen.key);
  }
  return out;
}

/** The selected landing page when accessible, otherwise Today,
 *  otherwise the first screen they can open, so
 *  nobody signs in to a 404. Account is the floor — everyone has that. */
export function homePathFor(
  home: string,
  permissions: readonly string[],
  screens: readonly string[],
  workspace: "all" | "desk" = "all"
): string {
  const visible = visibleScreens(screens, expandPermissions(permissions));
  // Apply the workspace boundary after resolving inherited administrator
  // access, so the desk wordmark never leads into the pool-deck workspace.
  if (workspace === "desk" || home === "reception-portal") {
    for (const key of visible) if (!isAquaticsScreen(key) || key === "instructor") visible.delete(key);
  }
  if ((home === "today" || home === "instructor") && visible.has("instructor")) return ROLE_HOMES.instructor.path;
  if (home === "calendar" && visible.has("calendar")) return ROLE_HOMES.calendar.path;
  if (home === "duty" && visible.has("duty")) return ROLE_HOMES.duty.path;
  if (visible.has("calendar")) return ROLE_HOMES.calendar.path;
  const first = SCREENS.find((screen) => visible.has(screen.key));
  return first ? first.path : "/account";
}

/** Separate modules never imply access to the swim-school workspace. */
/** Screens that open their own Turnfin workspace rather than Aquatics. */
const TURNFIN_WORKSPACES = new Set<string>(["docs", "refunds", "training", "hr", "rota"]);

export function isAquaticsScreen(key: ScreenKey) {
  return !TURNFIN_WORKSPACES.has(key);
}

/** The screens an administrator sees: every screen except those that need a
 *  restricted capability. A superadmin sees all of them. */
export const ADMINISTRATOR_SCREENS: ScreenKey[] = ALL_SCREENS.filter((key) => {
  const screen = SCREENS.find((s) => s.key === key);
  return !(screen && "requires" in screen && screen.requires && isRestrictedPermission(screen.requires));
});
