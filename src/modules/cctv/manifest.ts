import { Cctv } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// CCTV log (owner request, 20 October 2026): the first module in the Managers group.
export const cctvModule: ModuleManifest = {
  id: "cctv",
  group: "managers",
  name: "CCTV log",
  description: "A record of every time CCTV footage is checked: who checked it, why, what they looked for and what they saw",
  icon: Cctv,
  href: "/cctv/overview",
  logName: "CCTV log",
  access: {
    reach: "sites",
    levels: [
      { key: "record", label: "Record", help: "Record each time they check CCTV at their sites, and read their own entries.", permissions: ["cctv.record"] },
      { key: "review", label: "Review", help: "Also read every viewing recorded at their sites and add notes to them.", permissions: ["cctv.review"] },
    ],
  },
};
