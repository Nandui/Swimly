import { Files, ReceiptText, WavesLadder, type LucideIcon } from "lucide-react";
import type { PermissionKey } from "@/lib/staff/permissions";
import { isAquaticsScreen, type ScreenKey } from "@/lib/staff/screens";

/** Every module Turnfin offers, declared in one place.
 *
 *  A module is one area of the leisure centre's data with several audiences,
 *  and each audience gets its own surface (see DESIGN.md and the platform
 *  access plan). This registry is how the portal, the module switcher and the
 *  My hub find them: a module appears for someone because its manifest says
 *  so, never because a component remembered to add a boolean.
 *
 *  Visibility here is presentation. Security stays in each module's page
 *  guards, actions and the policy engine. */

export type ModuleContext = {
  screens: ReadonlySet<ScreenKey>;
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
  /** Whether this person has a Manage surface to open. The My hub is separate. */
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
  name: "Aquatics",
  description: "Run the swim school. Manage classes, swimmers, attendance and progress.",
  icon: WavesLadder,
  // Resolve permissions and the preferred workspace again when opened.
  href: "/start",
  visibleTo: ({ screens }) => [...screens].some(isAquaticsScreen),
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
