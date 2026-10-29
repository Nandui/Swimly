import { CalendarRange } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Plan (test) (owner decision, 29 October 2026): the rota started again from first principles,
// on test at one site beside the old Rota, which stays as it is.
export const planModule: ModuleManifest = {
  id: "plan",
  group: "team",
  name: "Plan (test)",
  description: "Who works when at each site, on which duties, with the gaps in what's on",
  icon: CalendarRange,
  href: "/plan/overview",
  logName: "Plan (test)",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the plan at their sites.", permissions: ["plan.view"] },
      { key: "plan", label: "Plan", help: "Plan shifts and duties for the departments they belong to, and mark people off.", permissions: ["plan.plan"] },
      { key: "manage", label: "Manage", help: "Plan every department, run today, and keep the duties, areas and what's on.", permissions: ["plan.manage"] },
    ],
  },
};
