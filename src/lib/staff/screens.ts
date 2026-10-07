import { isRestrictedPermission, type PermissionKey } from "@/lib/staff/permissions";

/** Every page area the app has, as menu entries.
 *
 *  Access has one language: permissions (docs/how-turnfin-works.md). A screen
 *  is simply a place in the menus that appears when the person holds its
 *  `requires` permission, which their role's levels give. Nothing stores
 *  screens; they are worked out from permissions every time.
 *
 *  The Account page is not in here: everyone can always change their own
 *  password there. */

export const SCREENS = [
  { key: "refunds", label: "Refunds", path: "/refunds", description: "A separate workspace for customer refund requests, finance decisions and external payment records.", requires: "refunds.read" },
  {
    key: "analytics",
    label: "Analytics",
    path: "/analytics",
    description: "Enrolled swimmers by level, recent enrolment activity and monthly class cancellations for the selected site.",
    requires: "courses.manage",
  },
  {
    key: "duty",
    label: "Duty manager",
    path: "/duty",
    description: "Today’s classes and quick details. Cancelling a session requires its separate permission.",
    requires: "classes.cancel",
  },
  {
    key: "cancellations",
    label: "Cancelled classes",
    path: "/cancellations",
    description: "Cancelled sessions and affected swimmers awaiting billing follow-up, with notification history.",
    requires: "billing.notify",
  },
  {
    key: "calendar",
    label: "Schedule",
    path: "/schedule",
    description:
      "Classes and assessments one day at a time, with a seven-day week navigator, instructors and available places.",
    requires: "swimschool.desk",
  },
  {
    key: "instructor",
    label: "Pool deck",
    path: "/instructor",
    description: "A separate tablet workspace for instructors: own classes, cover, attendance, competencies and today's assessments. Not shown in the desk navigation.",
    requires: "attendance.mark",
  },
  {
    key: "students",
    label: "Swimmers",
    path: "/students",
    description: "Every swimmer, their profile, contacts and progress.",
    requires: "swimschool.desk",
  },
  {
    key: "courses",
    label: "Classes",
    path: "/courses",
    description: "The timetable, each class, and attendance from weeks back.",
    requires: "swimschool.desk",
  },
  {
    key: "together",
    label: "Together",
    path: "/together",
    description: "A time that suits every child in one family.",
    requires: "swimschool.desk",
  },
  {
    key: "assessments",
    label: "Assessments",
    path: "/assessments",
    description: "Upcoming assessment rosters and session setup.",
    requires: "swimschool.desk",
  },
  {
    key: "awaiting-enrolment",
    label: "Awaiting enrolment",
    path: "/awaiting-enrolment",
    description: "Assessed swimmers awaiting a class and all class waitlists at the selected site. Enrolling requires its separate permission.",
    requires: "swimschool.desk",
  },
  {
    key: "legend-agreements",
    label: "Legend agreements",
    path: "/legend-agreements",
    description: "Active class places with outstanding Legend billing agreements, including existing enrolments that need checking. Confirming requires enrolment permission.",
    requires: "swimschool.desk",
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
    label: "Sites",
    path: "/clubs",
    description: "Which sites exist. Needs the permission to manage them.",
    requires: "clubs.manage",
  },
  { key: "departments", label: "Departments", path: "/departments", description: "The departments people belong to and activities are planned by.", requires: "setup.view" },
  { key: "qualifications", label: "Qualifications", path: "/qualifications", description: "The qualifications staff can hold.", requires: "setup.view" },
  { key: "activity-list", label: "Activities", path: "/activity-list", description: "The activities the rota plans and covers.", requires: "setup.view" },
  { key: "areas", label: "Areas", path: "/areas", description: "Each site's areas: pools, gym, reception.", requires: "setup.view" },
  {
    key: "activity",
    label: "Activity",
    path: "/activity",
    description: "The log of every change. Needs the permission to read it.",
    requires: "activity.view",
  },
  { key: "training", label: "Training", path: "/training", description: "A separate workspace for the training catalogue, assigning courses, trainer sign-off and expiring qualifications. Everyone completes their own training in Turnfin Me without it.", requires: "training.records.read" },
  { key: "rota", label: "Rota", path: "/rota", description: "Plan who is on which activity at a site, day by day, with every gap in cover counted; run today and record absences. Staff see their own days in Turnfin Me.", requires: "rota.view" },
  { key: "purchasing", label: "Purchasing", path: "/purchasing", description: "A separate workspace for purchase orders: approved suppliers and products, approval by role and amount, and numbered orders per site.", requires: "purchasing.read" },
  { key: "hr", label: "HR", path: "/hr", description: "A separate, restricted workspace for HR notes and performance reviews of the people a role covers. Staff read what is shared with them in Turnfin Me.", requires: "hr.records.read" },
  { key: "docs", label: "Docs", path: "/docs", description: "A separate workspace for documents, independent approvals and required reading.", requires: "docs.read" },
] as const satisfies readonly {
  key: string;
  label: string;
  path: string;
  description: string;
  requires: PermissionKey;
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

/** The screens this person can open: those whose permission they hold. */
export function visibleScreens(permissions: ReadonlySet<PermissionKey>): Set<ScreenKey> {
  return new Set(SCREENS.filter((screen) => permissions.has(screen.requires)).map((screen) => screen.key));
}

/** Which part of Turnfin each screen belongs to, stated rather than inferred.
 *
 *  - Core: the organisation itself (people, roles, sites, the activity log),
 *    shared by every module and opened in the Core workspace.
 *  - Activities: the swim school (desk and office) and the pool deck.
 *  - Work modules: Docs, Refunds, Training, HR and Rota, each its own workspace.
 *
 *  A new screen must be added to exactly one of these; a test checks it.
 *  Separate modules never imply access to the swim-school workspace. */
export const CORE_SCREENS = ["staff", "roles", "clubs", "departments", "qualifications", "activity-list", "areas", "activity"] as const satisfies readonly ScreenKey[];
export const ACTIVITIES_SCREENS = [
  "analytics", "duty", "cancellations", "calendar", "instructor", "students", "courses",
  "together", "assessments", "awaiting-enrolment", "legend-agreements", "programmes",
] as const satisfies readonly ScreenKey[];
export const WORK_MODULE_SCREENS = ["docs", "refunds", "training", "hr", "rota", "purchasing"] as const satisfies readonly ScreenKey[];

const CORE = new Set<string>(CORE_SCREENS);
const AQUATICS = new Set<string>(ACTIVITIES_SCREENS);

export function isCoreScreen(key: ScreenKey) {
  return CORE.has(key);
}

export function isActivitiesScreen(key: ScreenKey) {
  return AQUATICS.has(key);
}

/** The screens an administrator sees: every screen except those that need a
 *  restricted capability. A superadmin sees all of them. */
export const ADMINISTRATOR_SCREENS: ScreenKey[] = SCREENS.filter((screen) => !isRestrictedPermission(screen.requires)).map((screen) => screen.key);
