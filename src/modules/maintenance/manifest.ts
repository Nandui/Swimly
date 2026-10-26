import { Wrench } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Maintenance (owner, 26 October 2026, D14): what is broken at each site, from the first report
// until it is fixed, beside the maintenance team's own Trackplan.
export const maintenanceModule: ModuleManifest = {
  id: "maintenance",
  group: "managers",
  name: "Maintenance",
  description: "What is broken at each site, from the first report until it is fixed",
  icon: Wrench,
  href: "/maintenance/overview",
  logName: "Maintenance",
  access: {
    reach: "sites",
    levels: [
      { key: "report", label: "Report", help: "Report a problem at their sites, and see every request there.", permissions: ["maintenance.report"] },
      { key: "manage", label: "Manage", help: "Also put requests in Trackplan, correct them, mark them fixed or closed, and open them again.", permissions: ["maintenance.manage"] },
    ],
  },
};
