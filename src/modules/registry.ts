import { Award, CalendarClock, ClipboardCheck, Files, GraduationCap, HeartHandshake, ReceiptText, Settings, ShoppingCart, Waves, WavesLadder, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/staff/permissions";

/** Every module Turnfin offers, each described once (docs/how-turnfin-works.md).
 *
 *  A module's description says everything the rest of Turnfin needs: its name,
 *  where it opens, its levels and the permissions each level gives. Menus, the
 *  home page and the role editor are all built from these descriptions, so a
 *  new module is a folder plus one `registerModule` call.
 *
 *  Showing a module is presentation. Security stays in each page and action,
 *  which ask for a named permission. */

/** What the registry needs to know about the signed-in person. */
export type ModuleContext = {
  /** Every permission they hold anywhere: at the site they are working in,
   *  at their other sites, or over their team. */
  permissions: ReadonlySet<PermissionKey>;
};

/** Where a level applies. Swim school, Training and Rota work at the sites
 *  a person works at; HR "Their team" reaches the people they manage;
 *  everything else applies everywhere. See docs/how-turnfin-works.md. */
export type Reach = "sites" | "team" | "everywhere";

/** One step on a module's ladder. Levels are cumulative: a level gives its
 *  own permissions plus everything to its left. Pages and actions never ask
 *  for a level; they ask for the named permission. */
export type ModuleLevel = {
  key: string;
  label: string;
  /** One plain sentence, shown where the level is set. */
  help: string;
  permissions: readonly PermissionKey[];
  /** Overrides the module's reach (HR "Their team"). */
  reach?: Reach;
};

/** A single tick beside a module's levels, kept for the rare power that must
 *  not come with a level (approving your colleagues' documents). */
export type ModuleExtra = {
  key: string;
  label: string;
  help: string;
  /** The lowest level the extra makes sense with. */
  from: string;
  permissions: readonly PermissionKey[];
};

export type ModuleAccess = {
  reach: Reach;
  /** Every level above None, lowest first. */
  levels: readonly ModuleLevel[];
  extras?: readonly ModuleExtra[];
  /** Only a superadmin gives this module (HR). */
  restricted?: boolean;
};

/** The part of the centre a module serves. Presentation only: it orders and
 *  heads the module lists (role editor, module bar, home page) and never gives
 *  or checks access, which stays role, then level, then permission. */
export type ModuleGroup = "front-of-house" | "poolside" | "team" | "back-office";

/** Every group, in the order lists show them. */
export const MODULE_GROUPS: readonly { key: ModuleGroup; label: string }[] = [
  { key: "front-of-house", label: "Front of house" },
  { key: "poolside", label: "Poolside" },
  { key: "team", label: "Team" },
  { key: "back-office", label: "Back office" },
];

export type ModuleManifest = {
  /** Stable: stored as the key of `StaffRole.levels`. Never rename. */
  id: string;
  name: string;
  group: ModuleGroup;
  /** The overview page's subtitle: one line, no closing full stop. */
  description: string;
  icon: LucideIcon;
  /** How this module names itself in the shared activity log. */
  logName: string;
  access: ModuleAccess;
  href: string;
};

const MODULES: ModuleManifest[] = [];

export function registerModule(manifest: ModuleManifest) {
  if (MODULES.some((m) => m.id === manifest.id)) throw new Error(`Module ${manifest.id} is registered twice.`);
  MODULES.push(manifest);
}

const groupRank = (mod: ModuleManifest) => MODULE_GROUPS.findIndex((g) => g.key === mod.group);

/** Every module, group by group; within a group, in the order they registered. */
export function allModules(): readonly ModuleManifest[] {
  return [...MODULES].sort((a, b) => groupRank(a) - groupRank(b));
}

/** Modules under their group headings, leaving out empty groups. */
export function groupModules<M extends ModuleManifest>(modules: readonly M[]): { key: ModuleGroup; label: string; modules: M[] }[] {
  return MODULE_GROUPS
    .map((g) => ({ ...g, modules: modules.filter((m) => m.group === g.key) }))
    .filter((g) => g.modules.length > 0);
}

/** Every permission a module can give, across its levels and extras. */
export function modulePermissions(mod: ModuleManifest): PermissionKey[] {
  return [...mod.access.levels, ...(mod.access.extras ?? [])].flatMap((step) => [...step.permissions]);
}

/** The modules this person has: those where they hold any permission. */
export function visibleModules(ctx: ModuleContext): ModuleManifest[] {
  return allModules().filter((m) => modulePermissions(m).some((key) => ctx.permissions.has(key)));
}

// ---------------------------------------------------------------------------
// The modules. New modules register in their own manifest file and are
// imported from `src/modules/index.ts`.
// ---------------------------------------------------------------------------

// Lists show them group by group (MODULE_GROUPS), each group in this order.

registerModule({
  id: "swim-school",
  group: "front-of-house",
  name: "Swim school",
  // Swim school is the first activity type (see src/modules/activities/shared/types.ts).
  description: "Swimmers, classes and assessments at the desk, and the swim school's set-up",
  icon: WavesLadder,
  href: "/swim-school",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "desk", label: "Desk", help: "Every swimmer, booking, move, waitlist and assessment booking.",
        permissions: ["swimschool.desk", "students.manage", "enrolment.manage", "parents.manage"],
      },
      {
        key: "manage", label: "Manage", help: "Programmes, levels, classes and reports.",
        permissions: ["courses.manage", "curriculum.manage", "progression.override"],
      },
    ],
    extras: [
      {
        key: "cancel-classes", label: "Can cancel classes", help: "Cancel today's sessions on the duty manager page and pass them to billing.", from: "desk",
        permissions: ["classes.cancel", "billing.notify"],
      },
    ],
  },
});

registerModule({
  id: "academy",
  group: "front-of-house",
  name: "Academy",
  description: "The lifeguard and swim teacher courses we deliver: candidates, checks, registers and results",
  icon: Award,
  href: "/academy",
  logName: "Academy",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the courses at their sites.", permissions: ["academy.read"] },
      { key: "run", label: "Tutor", help: "Add candidates, record checks and payment, take registers and record results.", permissions: ["academy.run"] },
      { key: "manage", label: "Manage", help: "Keep the course list and put courses on, with sessions, tutor and price.", permissions: ["academy.manage"] },
    ],
  },
});

registerModule({
  id: "refunds",
  group: "front-of-house",
  name: "Refunds",
  description: "Customer refund requests, finance decisions and completed payments",
  icon: ReceiptText,
  href: "/refunds",
  logName: "Refunds",
  access: {
    reach: "everywhere",
    levels: [
      { key: "use", label: "Use", help: "Log a customer's refund request and follow it.", permissions: ["refunds.read", "refunds.request"] },
      { key: "manage", label: "Manage", help: "Decide refund requests and record payments. Nobody decides their own.", permissions: ["refunds.review", "refunds.process"] },
    ],
  },
});

// The pool deck is its own module: teaching is a different job from the desk
// (owner decision, 28 September 2026). Swim teachers see the class instructor
// view and nothing else; receptionists never see it unless given it too.
registerModule({
  id: "pool-deck",
  group: "poolside",
  name: "Pool deck",
  description: "Today's classes at the pool: attendance, competencies and assessments",
  icon: Waves,
  href: "/instructor",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "teach", label: "Teach", help: "Their own classes: attendance, competencies, assessments, and covering a colleague's class.",
        permissions: ["attendance.mark", "attendance.cover", "progression.assess", "progression.complete", "assessments.run"],
      },
      {
        key: "lead", label: "Lead", help: "Also take attendance for any class, for example copying in a paper register.",
        permissions: ["attendance.markAny"],
      },
    ],
  },
});

// Tasks (owner request, 8 October 2026; docs/tasks.md): each site's daily
// checks and logs, from templates on a schedule.
registerModule({
  id: "tasks",
  group: "poolside",
  name: "Tasks",
  description: "Each site's daily checks and logs: checklists, readings with acceptable ranges, approval and follow-up actions",
  icon: ClipboardCheck,
  href: "/tasks",
  logName: "Tasks",
  access: {
    reach: "sites",
    levels: [
      { key: "do", label: "Do", help: "The day's tasks at their sites that are aimed at their role, and raising follow-up actions.", permissions: ["tasks.complete"] },
      { key: "review", label: "Review", help: "Also approve and reopen tasks, mark them not applicable, resolve actions and see the reports.", permissions: ["tasks.review"] },
      { key: "manage", label: "Manage", help: "Also write the task templates: what each asks for, where, for whom and when.", permissions: ["tasks.manage"] },
    ],
  },
});

registerModule({
  id: "rota",
  group: "team",
  name: "Rota",
  description: "Who is on which activity at the sites you cover, with every gap in cover counted",
  icon: CalendarClock,
  href: "/rota/overview",
  logName: "Rota",
  access: {
    reach: "sites",
    // "manage" keeps its stored key (roles already hold it); it is the duty manager's Run.
    levels: [
      { key: "view", label: "View", help: "See the rota at their sites.", permissions: ["rota.view"] },
      { key: "plan", label: "Plan", help: "Plan the days ahead for the departments they belong to.", permissions: ["rota.plan"] },
      { key: "manage", label: "Run", help: "Run today and change any day for every department, report absences and keep the activity list.", permissions: ["rota.manage"] },
    ],
  },
});

registerModule({
  id: "training",
  group: "team",
  name: "Training",
  description: "Training for the people you cover: what is due, waiting for sign-off and done",
  icon: GraduationCap,
  href: "/training",
  logName: "Training",
  access: {
    reach: "sites",
    levels: [
      { key: "trainer", label: "Trainer", help: "Sign off practical training for people at their sites.", permissions: ["training.records.read", "training.signoff"] },
      { key: "manage", label: "Manage", help: "Create courses, assign them and check certificates.", permissions: ["training.manage", "training.assign", "qualifications.manage"] },
    ],
  },
});

registerModule({
  id: "docs",
  group: "team",
  name: "Docs",
  description: "Staff documents to read, write and approve, and who has read them",
  icon: Files,
  href: "/docs",
  logName: "Docs",
  access: {
    reach: "everywhere",
    levels: [
      { key: "read", label: "Read", help: "Read the documents aimed at their role.", permissions: ["docs.read"] },
      { key: "write", label: "Write", help: "Draft documents and send them for approval.", permissions: ["docs.write"] },
      { key: "manage", label: "Manage", help: "Aim documents at roles and see who has read them.", permissions: ["docs.manage"] },
    ],
    extras: [
      { key: "approve", label: "Can approve documents", help: "Approve and publish colleagues' documents, never their own.", from: "read", permissions: ["docs.approve"] },
    ],
  },
});

registerModule({
  id: "hr",
  group: "team",
  name: "HR",
  description: "Restricted staff files: details, employment, notes and performance reviews for the people you look after",
  icon: HeartHandshake,
  href: "/hr",
  logName: "HR",
  access: {
    reach: "everywhere",
    restricted: true,
    levels: [
      {
        key: "team", label: "Their team", help: "Staff files, notes and reviews for the people they manage.", reach: "team",
        permissions: ["hr.records.read", "hr.details.write", "hr.notes.write", "hr.reviews.write"],
      },
      { key: "all", label: "Everyone", help: "Staff files, notes and reviews for everyone.", permissions: [] },
    ],
  },
});

registerModule({
  id: "purchasing",
  group: "back-office",
  name: "Purchasing",
  description: "Raise purchase orders with approved suppliers, approved by role and amount, numbered per site.",
  icon: ShoppingCart,
  href: "/purchasing",
  logName: "Purchasing",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See their sites' orders, and approve those their role may approve.", permissions: ["purchasing.read"] },
      { key: "request", label: "Request", help: "Raise purchase orders at their sites.", permissions: ["purchasing.request"] },
      { key: "manage", label: "Manage", help: "Suppliers, approved products and prices, and who approves up to what.", permissions: ["purchasing.manage"] },
    ],
  },
});

// Admin is Core: the organisation every module shares (people, roles, sites
// and the activity log).
registerModule({
  id: "admin",
  group: "back-office",
  name: "Admin",
  description: "People, places and the work every module shares: staff, roles, sites and their areas, departments, qualifications and activities",
  // Settings, not Building2: the building means the working site everywhere else.
  icon: Settings,
  href: "/core",
  logName: "Admin",
  access: {
    reach: "everywhere",
    levels: [
      {
        key: "setup", label: "Setup",
        help: "See the shared setup lists (departments, positions, sites' areas, activities, qualifications). The ticks choose which they keep.",
        permissions: ["setup.view"],
      },
      {
        key: "manage",
        label: "Manage",
        help: "People, roles, sites and every setup list, and the activity log. Admins can also use every other module except HR.",
        // Every setup list too: an administrator holds all of Admin's ticks (effectiveLevels).
        permissions: ["staff.manage", "roles.manage", "clubs.manage", "activity.view"],
      },
    ],
    extras: [
      { key: "departments", label: "Keeps departments", help: "Add, rename and archive departments.", from: "setup", permissions: ["setup.departments"] },
      { key: "positions", label: "Keeps positions", help: "The positions people hold and the qualifications each needs.", from: "setup", permissions: ["setup.positions"] },
      { key: "qualifications", label: "Keeps the qualifications list", help: "The qualifications staff can hold.", from: "setup", permissions: ["setup.qualifications"] },
      { key: "activities", label: "Keeps the activity list", help: "What the rota plans, its departments and the qualifications it needs.", from: "setup", permissions: ["setup.activities"] },
      { key: "areas", label: "Keeps sites' areas", help: "Each site's pools, gym and other areas.", from: "setup", permissions: ["setup.areas"] },
    ],
  },
});
