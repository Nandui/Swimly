import { Activity } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Site Monitoring (owner request, 20 October 2026): actions raised
// automatically for managers, starting with task readings out of range.
export const siteMonitoringModule: ModuleManifest = {
  id: "site-monitoring",
  group: "managers",
  name: "Site Monitoring",
  description: "What managers need to act on at their sites, raised automatically, such as a reading out of range on a task",
  icon: Activity,
  href: "/site-monitoring/overview",
  logName: "Site Monitoring",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the actions raised at their sites and what was done about them.", permissions: ["site-monitoring.read"] },
      { key: "act", label: "Act", help: "Also close an action by saying what was done, or open it again.", permissions: ["site-monitoring.act"] },
    ],
  },
};
