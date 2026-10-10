import { Settings, type LucideIcon } from "lucide-react";
import { modules } from "@/app/modules";
import type { PermissionKey } from "@/lib/staff/permissions";

/** Every module Turnfin offers, each described once (docs/how-turnfin-works.md).
 *
 *  A module's description says everything the rest of Turnfin needs: its name,
 *  where it opens, its levels and the permissions each level gives. Menus, the
 *  home page and the role editor are all built from these descriptions, so a
 *  new module is a folder with a `manifest.ts`, plus one line in src/app/modules.ts.
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
function modulePermissions(mod: ModuleManifest): PermissionKey[] {
  return [...mod.access.levels, ...(mod.access.extras ?? [])].flatMap((step) => [...step.permissions]);
}

/** The modules this person has: those where they hold any permission. */
export function visibleModules(ctx: ModuleContext): ModuleManifest[] {
  return allModules().filter((m) => modulePermissions(m).some((key) => ctx.permissions.has(key)));
}

// ---------------------------------------------------------------------------
// The modules: each module's manifest.ts, listed once in src/app/modules.ts,
// then Admin, which is Core's own (people, roles, sites and the activity log).
// ---------------------------------------------------------------------------

// Admin is Core: the organisation every module shares (people, roles, sites
// and the activity log).
const adminModule: ModuleManifest = {
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
};

const MODULES: readonly ModuleManifest[] = [...modules, adminModule];
