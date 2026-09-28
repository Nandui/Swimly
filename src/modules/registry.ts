import { Building2, CalendarClock, Files, GraduationCap, HeartHandshake, ReceiptText, WavesLadder, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/staff/permissions";
import { isActivitiesScreen, isCoreScreen, type ScreenKey } from "@/lib/staff/screens";

/** Every module Turnfin offers, declared in one place.
 *
 *  A module is one area of the leisure centre's data with several audiences,
 *  and each audience gets its own surface (see DESIGN.md and the platform
 *  access plan). This registry is how the portal, the module switcher and the
 *  staff portal find them: a module appears for someone because its manifest says
 *  so, never because a component remembered to add a boolean.
 *
 *  Visibility here is presentation. Security stays in each module's page
 *  guards, actions and the policy engine. */

export type ModuleContext = {
  screens: ReadonlySet<ScreenKey>;
  /** Screens from additional roles at any scope (a department, their team).
   *  People-scoped modules such as Training open for these too; the module
   *  itself decides whose records they reach. */
  scopedScreens: ReadonlySet<string>;
  permissions: ReadonlySet<PermissionKey>;
  superadmin: boolean;
};

/** Where a level applies. Swim school, Training and Rota work at the sites
 *  a person works at; HR "Their team" reaches the people they manage;
 *  everything else applies everywhere. See docs/how-turnfin-works.md. */
export type Reach = "sites" | "team" | "everywhere";

/** One step on a module's ladder. Levels are cumulative: a level gives its
 *  own permissions and screens plus everything to its left. Pages and actions
 *  never ask for a level; they keep asking for the named permission. */
export type ModuleLevel = {
  key: string;
  label: string;
  /** One plain sentence, shown where the level is set. */
  help: string;
  permissions: readonly PermissionKey[];
  screens: readonly ScreenKey[];
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
  screens: readonly ScreenKey[];
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
  description: string;
  icon: LucideIcon;
  /** How this module names itself in the shared activity log. */
  logName: string;
  access: ModuleAccess;
  /** Offered on the Reception Portal as well as the general portal. */
  reception?: boolean;
  href: string;
  /** Whether this person has a Manage surface to open. Personal records live in Turnfin Me. */
  visibleTo(ctx: ModuleContext): boolean;
};

const MODULES: ModuleManifest[] = [];

export function registerModule(manifest: ModuleManifest) {
  if (MODULES.some((m) => m.id === manifest.id)) throw new Error(`Module ${manifest.id} is registered twice.`);
  MODULES.push(manifest);
}

export function allModules(): readonly ModuleManifest[] {
  return MODULES;
}

export function visibleModules(ctx: ModuleContext): ModuleManifest[] {
  return MODULES.filter((m) => m.visibleTo(ctx));
}

// ---------------------------------------------------------------------------
// The modules. New modules register in their own manifest file and are
// imported from `src/modules/index.ts`.
// ---------------------------------------------------------------------------

// In the order people meet them; Admin last.

registerModule({
  id: "swim-school",
  reception: true,
  name: "Swim school",
  // Swim school is the first activity type (see src/modules/activities/types.ts).
  description: "Run the swim school: classes, swimmers, attendance and progress. Camps, pool hire and fitness classes will join it.",
  icon: WavesLadder,
  // Resolve permissions and the preferred workspace again when opened.
  href: "/start",
  logName: "Swim school",
  access: {
    reach: "sites",
    levels: [
      {
        key: "teach", label: "Teach", help: "Their classes on the pool deck: attendance and progress.",
        permissions: ["attendance.mark", "attendance.cover", "progression.assess", "progression.complete"], screens: ["instructor"],
      },
      {
        key: "desk", label: "Desk", help: "Bookings, moves, waiting lists and assessments.",
        permissions: ["students.manage", "enrolment.manage", "attendance.markAny", "assessments.run", "parents.manage"],
        screens: ["calendar", "students", "courses", "together", "assessments", "awaiting-enrolment", "legend-agreements", "duty"],
      },
      {
        key: "manage", label: "Manage", help: "Programmes, levels, classes and reports.",
        permissions: ["courses.manage", "curriculum.manage", "progression.override"], screens: ["analytics", "programmes"],
      },
    ],
    extras: [
      {
        key: "cancel-classes", label: "Can cancel classes", help: "Cancel today's sessions and pass them to billing.", from: "desk",
        permissions: ["classes.cancel", "billing.notify"], screens: ["cancellations"],
      },
    ],
  },
  visibleTo: ({ screens }) => [...screens].some(isActivitiesScreen),
});

registerModule({
  id: "refunds",
  reception: true,
  name: "Refunds",
  description: "Submit customer refund requests, follow finance decisions and record completed payments.",
  icon: ReceiptText,
  href: "/refunds",
  logName: "Refunds",
  access: {
    reach: "everywhere",
    levels: [
      { key: "use", label: "Use", help: "Log a customer's refund request and follow it.", permissions: ["refunds.read", "refunds.request"], screens: ["refunds"] },
      { key: "manage", label: "Manage", help: "Decide refund requests and record payments. Nobody decides their own.", permissions: ["refunds.review", "refunds.process"], screens: [] },
    ],
  },
  visibleTo: ({ screens }) => screens.has("refunds"),
});

registerModule({
  id: "docs",
  reception: true,
  name: "Docs",
  description: "Read, write and approve staff documents. Track required reading.",
  icon: Files,
  href: "/docs",
  logName: "Docs",
  access: {
    reach: "everywhere",
    levels: [
      { key: "read", label: "Read", help: "Read the documents aimed at their role.", permissions: ["docs.read"], screens: ["docs"] },
      { key: "write", label: "Write", help: "Draft documents and send them for approval.", permissions: ["docs.write"], screens: [] },
      { key: "manage", label: "Manage", help: "Aim documents at roles and see who has read them.", permissions: ["docs.manage"], screens: [] },
    ],
    extras: [
      { key: "approve", label: "Can approve documents", help: "Approve and publish colleagues' documents, never their own.", from: "read", permissions: ["docs.approve"], screens: [] },
    ],
  },
  visibleTo: ({ screens }) => screens.has("docs"),
});

registerModule({
  id: "training",
  name: "Training",
  description: "Build courses, assign training, sign off practical skills and follow expiring qualifications.",
  icon: GraduationCap,
  href: "/training",
  logName: "Training",
  access: {
    reach: "sites",
    levels: [
      { key: "trainer", label: "Trainer", help: "Sign off practical training for people at their sites.", permissions: ["training.records.read", "training.signoff"], screens: ["training"] },
      { key: "manage", label: "Manage", help: "Create courses, assign them and check certificates.", permissions: ["training.manage", "training.assign", "qualifications.manage"], screens: [] },
    ],
  },
  // Completing your own training happens in Turnfin Me; this is the Manage surface.
  visibleTo: ({ screens, scopedScreens }) => screens.has("training") || scopedScreens.has("training"),
});

registerModule({
  id: "rota",
  name: "Rota",
  description: "Plan the week's shifts at a site, with warnings for expired qualifications.",
  icon: CalendarClock,
  href: "/rota",
  logName: "Rota",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the rota at their sites.", permissions: ["rota.view"], screens: ["rota"] },
      { key: "manage", label: "Manage", help: "Plan and change shifts.", permissions: ["rota.manage"], screens: [] },
    ],
  },
  // A site-scoped duty role brings the screen with it.
  visibleTo: ({ screens, scopedScreens, superadmin }) => superadmin || screens.has("rota") || scopedScreens.has("rota"),
});

registerModule({
  id: "hr",
  name: "HR and performance",
  description: "Notes and performance reviews for the people you look after. Restricted.",
  icon: HeartHandshake,
  href: "/hr",
  logName: "HR",
  access: {
    reach: "everywhere",
    restricted: true,
    levels: [
      {
        key: "team", label: "Their team", help: "Notes and reviews for the people they manage.", reach: "team",
        permissions: ["hr.records.read", "hr.notes.write", "hr.reviews.write"], screens: ["hr"],
      },
      { key: "all", label: "Everyone", help: "HR notes and reviews for everyone.", permissions: [], screens: [] },
    ],
  },
  // The flat HR screen already requires hr.records.read, which administrators
  // never inherit; a department or team HR role brings the screen with it.
  visibleTo: ({ screens, scopedScreens, superadmin }) => superadmin || screens.has("hr") || scopedScreens.has("hr"),
});

// Core is not a module but the organisation every module shares: people,
// roles, sites and the activity log. It gets a tile for the people who manage it.
registerModule({
  id: "admin",
  name: "Admin",
  description: "Staff, roles, sites and the activity log, shared by every module.",
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
        screens: ["staff", "roles", "clubs", "activity"],
      },
    ],
  },
  visibleTo: ({ screens }) => [...screens].some(isCoreScreen),
});
