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
 *  **Reads are not in here.** Any signed-in person can look at swimmers,
 *  classes, the curriculum and the registers, exactly as before. Every entry
 *  below is the power to *change* something, or to read the audit log — the
 *  one read that names what everyone else did. Making reads grantable is a
 *  bigger job than this and a different decision; it would mean every data
 *  function taking a permission and every page having an empty state for
 *  "you may not see this". */

export const PERMISSIONS = [
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
      "Put a swimmer in a class, move them between classes, end an enrolment. Includes placing someone out of sequence with a reason.",
  },
  {
    key: "attendance.mark",
    group: "On the deck",
    label: "Take the register for their own classes",
    description:
      "Mark attendance for classes they are the instructor of. Without this the Today page is not offered.",
  },
  {
    key: "attendance.markAny",
    group: "On the deck",
    label: "Take the register for any class",
    description:
      "Mark attendance for classes they do not teach — cover staff, or whoever is holding the tablet. Includes the previous permission.",
  },
  {
    key: "progression.assess",
    group: "On the deck",
    label: "Assess and complete levels",
    description:
      "Tick competencies off, and confirm a swimmer has finished a level once everything is signed off.",
  },
  {
    key: "progression.override",
    group: "On the deck",
    label: "Complete a level with gaps",
    description:
      "Sign a swimmer off with competencies still outstanding, giving a reason. Includes the previous permission.",
  },
  {
    key: "courses.manage",
    group: "The rules",
    label: "Edit the timetable",
    description: "Add, edit and archive classes, their times, capacities and instructors.",
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
  "Swimmers",
  "On the deck",
  "The rules",
  "Administration",
];

const ALL_KEYS = new Set<string>(PERMISSIONS.map((p) => p.key));

/** Permissions that contain smaller ones. Holding the greater grants the
 *  lesser, so a role given "take any register" and not "take their own" still
 *  reaches the Today page, and nobody has to know to tick both. Kept here
 *  rather than solved at each call site, because the call site that forgets is
 *  the one that quietly locks someone out. */
const IMPLIES: Partial<Record<PermissionKey, PermissionKey[]>> = {
  "attendance.markAny": ["attendance.mark"],
  "progression.override": ["progression.assess"],
};

/** Expands stored keys into everything they actually grant, dropping any that
 *  are no longer in the catalogue. */
export function expandPermissions(stored: readonly string[]): Set<PermissionKey> {
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

/** What the three shipped roles hold, and what a fresh database is seeded
 *  with. These are starting points an admin may edit, not a hierarchy the app
 *  enforces — nothing in the code refers to a role by name. */
export const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: PermissionKey[];
}[] = [
  {
    name: "Admin",
    description: "Everything, including the timetable, the curriculum and these accounts.",
    permissions: [...ALL_PERMISSIONS],
  },
  {
    name: "Instructor",
    description: "Registers, assessments, swimmers and enrolments. Not the curriculum.",
    permissions: [
      "students.manage",
      "enrolment.manage",
      "attendance.mark",
      "progression.assess",
    ],
  },
  {
    name: "Viewer",
    description: "Can look things up and change nothing. Reception, or a duty manager.",
    permissions: [],
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
