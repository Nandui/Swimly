import type { Role } from "@/generated/prisma/client";

/** Every permission the app has to give, and nothing else.
 *
 *  This catalogue is **code, not data**. A permission exists because a screen
 *  or an action asks for it, so the list can only change when the app does —
 *  which is why `StaffRole.permissions` is a string array rather than rows in
 *  a Permission table that would have to be kept in step by hand.
 *
 *  Two consequences worth naming:
 *
 *  **Unknown keys are ignored, never fatal.** A role holding a key that no
 *  longer exists simply does not get anything for it. That is what makes
 *  deleting a permission from this file a safe edit rather than one that
 *  needs a data migration first.
 *
 *  **Screens have their own catalogue.** Permissions allow actions within
 *  those screens. Administrator access includes both catalogues automatically;
 *  other roles keep their explicit grants. */

export const PERMISSIONS = [
  { key: "docs.read", group: "Docs", label: "Read published documents", description: "Open Docs, read published versions and acknowledge assigned reading. Also needs the Docs screen." },
  { key: "docs.write", group: "Docs", label: "Author documents", description: "Create and edit drafts, submit for independent approval and view reading reports. Includes reading." },
  { key: "docs.approve", group: "Docs", label: "Approve documents", description: "Review and publish documents written by other staff. Includes authoring; never permits self-approval." },
  { key: "docs.manage", group: "Docs", label: "Administer Docs", description: "Manage document teams, templates, risk matrix and reading assignments. Includes authoring, but approval requires its separate permission." },
  {
    key: "parents.manage",
    group: "Swimmers",
    label: "Manage parent access",
    description: "Approve or revoke a parent's access to a swimmer, and suspend parent accounts. Does not grant staff access.",
  },
  {
    key: "classes.cancel",
    group: "Daily operations",
    label: "Cancel today’s class sessions",
    description: "Cancel a dated session from Duty manager and create its billing follow-up record. Does not archive the weekly class.",
  },
  {
    key: "billing.notify",
    group: "Daily operations",
    label: "Record billing notifications",
    description: "Mark a cancelled session as notified to billing, with a handoff note. Does not change bills or send messages.",
  },
  {
    key: "students.manage",
    group: "Swimmers",
    label: "Add and edit swimmers",
    description: "Create a swimmer, correct their details, record a contact.",
  },
  {
    key: "enrolment.manage",
    group: "Swimmers",
    label: "Enrol and move swimmers",
    description:
      "Put a swimmer in a class, move them between classes, end an enrolment, book them on an assessment and confirm Legend billing agreements. Includes placing someone out of sequence with a reason.",
  },
  {
    key: "attendance.mark",
    group: "On the deck",
    label: "Take attendance for their own classes",
    description:
      "Mark attendance for the classes they teach. The separate Instructor workspace also requires the Instructor screen grant.",
  },
  {
    key: "attendance.cover",
    group: "On the deck",
    label: "Take over another instructor's class",
    description:
      "Say they are taking a class that is not theirs for the day, which the attendance records. Without this they can look at a colleague's class but not mark it.",
  },
  {
    key: "attendance.markAny",
    group: "On the deck",
    label: "Take attendance for any class",
    description:
      "Mark attendance for classes they do not teach without taking them over — the desk copying in a paper sheet, or whoever is holding the tablet. Includes the two above.",
  },
  {
    key: "progression.assess",
    group: "On the deck",
    label: "Mark competencies",
    description: "Tick competencies off as achieved or working on it, for the classes they may mark.",
  },
  {
    key: "progression.complete",
    group: "On the deck",
    label: "Complete a level",
    description:
      "Confirm a swimmer has finished a level once every competency is signed off. Includes marking competencies.",
  },
  {
    key: "progression.override",
    group: "On the deck",
    label: "Complete a level with gaps",
    description:
      "Sign a swimmer off with competencies still outstanding, giving a reason, and take a completion back. Includes the two above.",
  },
  {
    key: "assessments.run",
    group: "On the deck",
    label: "Run assessment sessions",
    description:
      "At a Swim School Assessment, mark who came and place each child at a level.",
  },
  {
    key: "courses.manage",
    group: "The rules",
    label: "Edit the timetable",
    description:
      "Add, edit and archive classes, their times, capacities and instructors, and the assessment sessions.",
  },
  {
    key: "curriculum.manage",
    group: "The rules",
    label: "Edit the curriculum",
    description:
      "Programmes, levels and competencies — what a swimmer works through and in what order.",
  },
  {
    key: "staff.manage",
    group: "Administration",
    label: "Manage staff accounts",
    description: "Add people, change their role or email, set passwords, deactivate accounts.",
  },
  {
    key: "roles.manage",
    group: "Administration",
    label: "Manage roles",
    description:
      "Create roles and decide what each one may do — including this permission. Give it carefully.",
  },
  {
    key: "clubs.manage",
    group: "Administration",
    label: "Manage clubs",
    description:
      "Add a site, rename one, retire one. Which club a person is working in is theirs to switch; this is about which clubs exist.",
  },
  {
    key: "activity.view",
    group: "Administration",
    label: "Read the activity log",
    description: "See every change anyone has made, and who made it.",
  },
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

export type PermissionGroup = (typeof PERMISSIONS)[number]["group"];

/** The order groups are offered in: the everyday work first, the powerful
 *  things last, so nobody ticks Administration on their way past. */
export const PERMISSION_GROUP_ORDER: PermissionGroup[] = [
  "Daily operations",
  "Swimmers",
  "On the deck",
  "The rules",
  "Docs",
  "Administration",
];

const ALL_KEYS = new Set<string>(PERMISSIONS.map((p) => p.key));

/** Together these keys grant administrator access. Neither key alone does.
 *  Resolve from current grants, never the editable role name or legacy enum. */
export const ADMINISTRATOR_PERMISSIONS: readonly PermissionKey[] = ["staff.manage", "roles.manage"];

export function hasAdministratorAccess(permissions: Iterable<string>): boolean {
  const held = new Set(permissions);
  return ADMINISTRATOR_PERMISSIONS.every((key) => held.has(key));
}

/** Permissions that contain smaller ones. Holding the greater grants the
 *  lesser, so a role given "take any register" and not "take their own" still
 *  reaches the Today page, and nobody has to know to tick both. Kept here
 *  rather than solved at each call site, because the call site that forgets is
 *  the one that quietly locks someone out. */
const IMPLIES: Partial<Record<PermissionKey, PermissionKey[]>> = {
  "docs.write": ["docs.read"],
  "docs.approve": ["docs.read", "docs.write"],
  "docs.manage": ["docs.read", "docs.write"],
  "attendance.markAny": ["attendance.mark", "attendance.cover"],
  "progression.complete": ["progression.assess"],
  "progression.override": ["progression.complete", "progression.assess"],
};

/** Expands stored keys into everything they actually grant, dropping any that
 *  are no longer in the catalogue. */
export function expandPermissions(stored: readonly string[]): Set<PermissionKey> {
  // Existing administrators inherit new capabilities without editing a role
  // whenever the catalogue grows. Demotion takes effect on the next request.
  if (hasAdministratorAccess(stored)) return new Set(ALL_PERMISSIONS);
  const out = new Set<PermissionKey>();
  for (const key of stored) {
    if (!ALL_KEYS.has(key)) continue;
    const permission = key as PermissionKey;
    out.add(permission);
    for (const implied of IMPLIES[permission] ?? []) out.add(implied);
  }
  return out;
}

export function permissionMeta(key: PermissionKey) {
  return PERMISSIONS.find((p) => p.key === key)!;
}

/** Every key, for the "give this role everything" case. */
export const ALL_PERMISSIONS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

/** Where a role lands after signing in, and where the wordmark goes. A
 *  metadata map like every other enum: the role stores the key, the app
 *  reads the path from here. An instructor's day starts on the deck; the
 *  desk's starts on Today. */
export const ROLE_HOMES = {
  duty: {
    label: "Duty manager",
    path: "/duty",
    description: "Today’s classes, quick details and session cancellations.",
  },
  today: {
    // Compatibility for existing roles and sessions. Not offered by new forms.
    label: "Instructor",
    path: "/instructor",
    description: "Own classes, attendance and competencies on the deck.",
  },
  instructor: {
    label: "Instructor",
    path: "/instructor",
    description: "Own classes, attendance and competencies. Needs the Instructor screen and attendance permission.",
  },
  calendar: {
    label: "Schedule",
    path: "/schedule",
    description: "Classes and assessments for a selected day. Needs the Schedule screen; attendance keeps its own permission.",
  },
} as const;

export type RoleHome = keyof typeof ROLE_HOMES;

export const ROLE_HOME_ORDER: RoleHome[] = ["calendar", "duty", "instructor"];

export function normaliseRoleHome(value: unknown): RoleHome {
  if (value === "today") return "instructor";
  return isRoleHome(value) ? value : "calendar";
}

export function isRoleHome(value: unknown): value is RoleHome {
  return typeof value === "string" && Object.hasOwn(ROLE_HOMES, value);
}

/** What the three shipped roles hold, and what a fresh database is seeded
 *  with. These are starting points an admin may edit, not a hierarchy the app
 *  enforces — nothing in the code refers to a role by name. Screen keys are
 *  strings here rather than `ScreenKey` to keep this file free of a cycle
 *  with `screens.ts`; the seed cleans them against the catalogue. */
export const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: PermissionKey[];
  home: RoleHome;
  screens: string[];
}[] = [
  {
    name: "Admin",
    description: "Everything, including the timetable, the curriculum and these accounts.",
    permissions: [...ALL_PERMISSIONS],
    home: "calendar",
    screens: [
      "analytics",
      "calendar",
      "duty",
      "cancellations",
      "instructor",
      "students",
      "courses",
      "together",
      "assessments",
      "programmes",
      "staff",
      "roles",
      "clubs",
      "activity",
    ],
  },
  {
    name: "Instructor",
    description: "The deck and nothing else: their classes today, attendance and competencies.",
    permissions: ["attendance.mark", "attendance.cover", "progression.complete"],
    home: "instructor",
    screens: ["instructor"],
  },
  {
    name: "Viewer",
    description: "Can look things up and change nothing. Reception, or a duty manager.",
    permissions: [],
    home: "calendar",
    screens: ["calendar", "students", "courses", "together", "assessments"],
  },
];

/** Derives the legacy `User.role` enum from what a role actually holds, so the
 *  column stays truthful for the previous release still reading it. Delete
 *  this with the column.
 *
 *  It is deliberately coarse — three tiers cannot describe an arbitrary
 *  permission set, and pretending otherwise would be worse than rounding. */
export function legacyRoleFor(permissions: readonly string[]): Role {
  const held = expandPermissions(permissions);
  if (held.has("staff.manage") || held.has("roles.manage")) return "ADMIN";
  if (held.size > 0) return "INSTRUCTOR";
  return "VIEWER";
}
