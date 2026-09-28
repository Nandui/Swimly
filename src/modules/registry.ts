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

export type ModuleManifest = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
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

// Core is not a module but the organisation every module shares: people,
// roles, sites and the activity log. It gets a tile for the people who manage it.
registerModule({
  id: "core",
  name: "Core",
  description: "Staff, roles, sites and the activity log, shared by every module.",
  icon: Building2,
  href: "/core",
  visibleTo: ({ screens }) => [...screens].some(isCoreScreen),
});

registerModule({
  id: "refunds",
  reception: true,
  name: "Refunds",
  description: "Submit customer refund requests, follow finance decisions and record completed payments.",
  icon: ReceiptText,
  href: "/refunds",
  visibleTo: ({ screens }) => screens.has("refunds"),
});

registerModule({
  id: "swimly",
  reception: true,
  name: "Activities",
  // Swim school is the first activity type (see src/modules/activities/types.ts).
  description: "Run the swim school: classes, swimmers, attendance and progress. Camps, pool hire and fitness classes will join it.",
  icon: WavesLadder,
  // Resolve permissions and the preferred workspace again when opened.
  href: "/start",
  visibleTo: ({ screens }) => [...screens].some(isActivitiesScreen),
});

registerModule({
  id: "docs",
  reception: true,
  name: "Docs",
  description: "Read, write and approve staff documents. Track required reading.",
  icon: Files,
  href: "/docs",
  visibleTo: ({ screens }) => screens.has("docs"),
});

registerModule({
  id: "training",
  name: "Training",
  description: "Build courses, assign training, sign off practical skills and follow expiring qualifications.",
  icon: GraduationCap,
  href: "/training",
  // Completing your own training happens in Turnfin Me; this is the Manage surface.
  visibleTo: ({ screens, scopedScreens }) => screens.has("training") || scopedScreens.has("training"),
});

registerModule({
  id: "hr",
  name: "HR and performance",
  description: "Notes and performance reviews for the people you look after. Restricted.",
  icon: HeartHandshake,
  href: "/hr",
  // The flat HR screen already requires hr.records.read, which administrators
  // never inherit; a department or team HR role brings the screen with it.
  visibleTo: ({ screens, scopedScreens, superadmin }) => superadmin || screens.has("hr") || scopedScreens.has("hr"),
});

registerModule({
  id: "rota",
  name: "Rota",
  description: "Plan the week's shifts at a site, with warnings for expired qualifications.",
  icon: CalendarClock,
  href: "/rota",
  // A site-scoped duty role brings the screen with it.
  visibleTo: ({ screens, scopedScreens, superadmin }) => superadmin || screens.has("rota") || scopedScreens.has("rota"),
});
