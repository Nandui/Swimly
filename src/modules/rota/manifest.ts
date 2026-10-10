import { CalendarClock } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const rotaModule: ModuleManifest = {
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
};
