import type { Role } from "@/generated/prisma/client";

/** Every permission the app has to give, and nothing else: the one access
 *  language (docs/how-turnfin-works.md). A role's levels give permissions;
 *  pages, menus and actions ask for a permission, never a level or a role.
 *
 *  This catalogue is **code, not data**. A permission exists because a page
 *  or an action asks for it. Unknown keys stored on a role are ignored, never
 *  fatal, so deleting a permission here needs no data migration first. */

export const PERMISSIONS = [
  { key: "refunds.read", group: "Refunds", label: "Read refund requests", description: "Open Refunds and follow submitted requests across sites. Drafts remain private to their creator." },
  { key: "refunds.request", group: "Refunds", label: "Submit refund requests", description: "Create private drafts, submit requests and answer finance queries. Includes reading." },
  { key: "refunds.review", group: "Refunds", label: "Review refund requests", description: "Take responsibility, request information, approve or decline other staff's requests. Includes reading, not payment recording." },
  { key: "refunds.process", group: "Refunds", label: "Record refund payments", description: "Record external payment of approved refunds and cancel unpaid approvals. Includes reading, not approval." },
  { key: "docs.read", group: "Docs", label: "Read published documents", description: "Open Docs, read published versions and acknowledge assigned reading." },
  { key: "docs.write", group: "Docs", label: "Author documents", description: "Create and edit drafts and submit them for independent approval. Includes reading." },
  { key: "docs.approve", group: "Docs", label: "Approve documents", description: "Review and publish documents written by other staff. Includes authoring; never permits self-approval." },
  { key: "docs.manage", group: "Docs", label: "Administer Docs", description: "Manage document teams, templates, risk matrix, reading assignments and reading reports. Includes authoring, but approval requires its separate permission." },
  {
    key: "swimschool.desk",
    group: "Swimmers",
    label: "Use the swim school desk",
    description: "Find swimmers, classes, the schedule, assessments and the waitlist. Changing them needs the permissions below.",
  },
  {
    key: "parents.manage",
    group: "Swimmers",
    label: "Manage parent access",
    description: "Approve or revoke a parent's access to a swimmer, and suspend parent accounts. Does not give staff access.",
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
      "Mark attendance for the classes they teach, on the pool deck.",
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
      "Mark attendance for classes they do not teach without taking them over: the desk copying in a paper sheet, or whoever is holding the tablet. Includes the two above.",
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
        "Confirm a swimmer has finished a level and is ready to move once every competency is signed off. Includes marking competencies.",
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
      "At a swim school assessment, mark who came and place each child at a level.",
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
      "Programmes, levels and competencies: what a swimmer works through and in what order.",
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
      "Create roles and decide what each one may do, including this permission. Give it carefully.",
  },
  {
    key: "clubs.manage",
    group: "Administration",
    label: "Manage sites",
    description:
      "Add, rename and archive sites. Each person still chooses the site they are working at.",
  },
  {
    key: "qualifications.manage",
    group: "People",
    label: "Record qualifications",
    description: "Record, verify and revoke staff qualifications such as NPLQ and first aid for the people this role covers (everyone, a site, a department or their direct reports).",
  },
  {
    key: "training.manage",
    group: "Training",
    label: "Build the training catalogue",
    description: "Create, edit and retire training courses, and choose which qualification a course gives. Assigning and signing off are separate.",
  },
  {
    key: "training.assign",
    group: "Training",
    label: "Assign training",
    description: "Assign courses with a due date, and cancel assignments, for the people this role covers. Includes reading their training records.",
  },
  {
    key: "training.records.read",
    group: "Training",
    label: "Read training records",
    description: "See the training and qualifications of the people this role covers (everyone, a site, a department or their direct reports).",
  },
  {
    key: "training.signoff",
    group: "Training",
    label: "Sign off practical training",
    description: "Confirm that someone this role covers has shown the skill in person, which completes the course and records any qualification. Never your own.",
  },
  {
    key: "rota.view",
    group: "Rota",
    label: "See the rota",
    description: "See who is on shift at the sites this role covers, with qualification warnings.",
  },
  {
    key: "rota.manage",
    group: "Rota",
    label: "Plan the rota",
    description: "Add, change, fill and cancel shifts at the sites this role covers. Includes seeing it.",
  },
  {
    key: "hr.records.read",
    group: "HR",
    label: "Read HR records",
    description: "Open the HR records (notes and reviews) of the people this role covers. Restricted: only a superadmin can give it, and it asks for your password again.",
    restricted: true,
  },
  {
    key: "hr.notes.write",
    group: "HR",
    label: "Write HR notes",
    description: "Add notes to the HR record of the people this role covers, kept private, on their record or shared with them. Includes reading. Restricted.",
    restricted: true,
  },
  {
    key: "hr.reviews.write",
    group: "HR",
    label: "Write performance reviews",
    description: "Draft performance reviews for the people this role covers and share them with the person. Includes reading. Restricted.",
    restricted: true,
  },
  {
    key: "work.anywhere",
    group: "Administration",
    label: "Work from any device",
    description: "Sign in away from a registered work PC, for example on a phone. Without it, staff can only sign in on registered work PCs (once that rule is switched on).",
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
  "Refunds",
  "People",
  "Training",
  "Rota",
  "HR",
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
  // Anyone who changes swimmers, bookings or the timetable uses the desk.
  // Roles not yet converted to levels keep their desk pages through this.
  "students.manage": ["swimschool.desk"],
  "enrolment.manage": ["swimschool.desk"],
  "parents.manage": ["swimschool.desk"],
  "courses.manage": ["swimschool.desk"],
  "curriculum.manage": ["swimschool.desk"],
  "refunds.request": ["refunds.read"],
  "refunds.review": ["refunds.read"],
  "refunds.process": ["refunds.read"],
  "docs.write": ["docs.read"],
  "docs.approve": ["docs.read", "docs.write"],
  "docs.manage": ["docs.read", "docs.write"],
  "attendance.markAny": ["attendance.mark", "attendance.cover"],
  "progression.complete": ["progression.assess"],
  "progression.override": ["progression.complete", "progression.assess"],
  "training.manage": ["training.records.read"],
  "training.assign": ["training.records.read"],
  "training.signoff": ["training.records.read"],
  "rota.manage": ["rota.view"],
  "hr.notes.write": ["hr.records.read"],
  "hr.reviews.write": ["hr.records.read"],
};

/** Restricted capabilities (HR, performance): never inherited by
 *  administrators. They reach a person only through a role a superadmin
 *  assigned, or through the superadmin flag itself. */
export function isRestrictedPermission(key: string): boolean {
  const meta = PERMISSIONS.find((p) => p.key === key);
  return !!meta && "restricted" in meta && meta.restricted === true;
}

/** Expands stored keys into everything they actually grant, dropping any that
 *  are no longer in the catalogue.
 *
 *  Three tiers: a **superadmin** holds every key, restricted ones included; an
 *  **administrator** (staff.manage + roles.manage) holds every key that is not
 *  restricted, including ones added to the catalogue later; everyone else holds
 *  exactly what their roles grant, with implications. */
export function expandPermissions(
  stored: readonly string[],
  options: { superadmin?: boolean } = {},
): Set<PermissionKey> {
  if (options.superadmin) return new Set(ALL_PERMISSIONS);
  // Existing administrators inherit new capabilities without editing a role
  // whenever the catalogue grows. Demotion takes effect on the next request.
  // Restricted keys are held only if a role explicitly grants them.
  if (hasAdministratorAccess(stored)) {
    const out = new Set(ALL_PERMISSIONS.filter((key) => !isRestrictedPermission(key)));
    for (const key of stored) if (ALL_KEYS.has(key) && isRestrictedPermission(key)) out.add(key as PermissionKey);
    return out;
  }
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

/** What administrators hold: every key except restricted ones (HR, performance). */
export const UNRESTRICTED_PERMISSIONS: PermissionKey[] = ALL_PERMISSIONS.filter((key) => !isRestrictedPermission(key));

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
