import type { TagColor } from "@/components/ui-kit/tag";
import { allModules, type ModuleManifest } from "@/modules";

export const PORTAL_BRAND = "Turnfin";
export const PORTAL_NAME = `${PORTAL_BRAND} staff portal`;

export const moduleStatusMeta = {
  available: { label: "Available", color: "green" },
} satisfies Record<string, { label: string; color: TagColor }>;

/** Every registered module. Declared in `src/modules`; kept under this name
 *  for the portal components that list them. Bookings is not planned: Legend
 *  remains the booking and billing system. */
export const STAFF_MODULES: readonly (ModuleManifest & { status: "available" })[] =
  allModules().map((module) => ({ ...module, status: "available" as const }));
