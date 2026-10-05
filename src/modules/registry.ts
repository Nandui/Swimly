import { Building2, CalendarClock, Files, GraduationCap, HeartHandshake, ReceiptText, Waves, WavesLadder, type LucideIcon } from "lucide-react";
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

export type ModuleManifest = {
  /** Stable: stored as the key of `StaffRole.levels`. Never rename. */
  id: string;
  name: string;
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

export function allModules(): readonly ModuleManifest[] {
  return MODULES;
}

/** Every permission a module can give, across its levels and extras. */
export function modulePermissions(mod: ModuleManifest): PermissionKey[] {
  return [...mod.access.levels, ...(mod.access.extras ?? [])].flatMap((step) => [...step.permissions]);
}

/** The modules this person has: those where they hold any permission. */
export function visibleModules(ctx: ModuleContext): ModuleManifest[] {
  return MODULES.filter((m) => modulePermissions(m).some((key) => ctx.permissions.has(key)));
}

// ---------------------------------------------------------------------------
// The modules. New modules register in their own manifest file and are
// imported from `src/modules/index.ts`.
// ---------------------------------------------------------------------------

// In the order people meet them; Admin last.

registerModule({
  id: "swim-school",
  name: "Swim school",
  // Swim school is the first activity type (see src/modules/activities/types.ts).
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
        key: "cancel-classes", label: "Can cancel classes", help: "The duty manager page: cancel today's sessions and pass them to billing.", from: "desk",
        permissions: ["classes.cancel", "billing.notify"],
      },
    ],
  },
});

// The pool deck is its own module: teaching is a different job from the desk
// (owner decision, 28 September 2026). Swim teachers see the class instructor
// view and nothing else; receptionists never see it unless given it too.
registerModule({
  id: "pool-deck",
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

registerModule({
  id: "refunds",
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

registerModule({
  id: "docs",
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
  id: "training",
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
  id: "rota",
  name: "Rota",
  description: "Shifts at the sites you cover, with warnings for expired qualifications and people who are off",
  icon: CalendarClock,
  href: "/rota/overview",
  logName: "Rota",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the rota at their sites.", permissions: ["rota.view"] },
      { key: "manage", label: "Manage", help: "Plan and change shifts.", permissions: ["rota.manage"] },
    ],
  },
});

registerModule({
  id: "hr",
  name: "HR",
  description: "Restricted notes and performance reviews for the people you look after",
  icon: HeartHandshake,
  href: "/hr",
  logName: "HR",
  access: {
    reach: "everywhere",
    restricted: true,
    levels: [
      {
        key: "team", label: "Their team", help: "Notes and reviews for the people they manage.", reach: "team",
        permissions: ["hr.records.read", "hr.notes.write", "hr.reviews.write"],
      },
      { key: "all", label: "Everyone", help: "HR notes and reviews for everyone.", permissions: [] },
    ],
  },
});

// Admin is Core: the organisation every module shares (people, roles, sites
// and the activity log).
registerModule({
  id: "admin",
  name: "Admin",
  description: "People, roles and sites, and the activity log, shared by every module",
  icon: Building2,
  href: "/core",
  logName: "Admin",
  access: {
    reach: "everywhere",
    levels: [
      {
        key: "manage",
        label: "Manage",
        help: "People, roles and sites, and the activity log. Admins can also use every other module except HR.",
        permissions: ["staff.manage", "roles.manage", "clubs.manage", "activity.view"],
      },
    ],
  },
});
