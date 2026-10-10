import { Award } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const academyModule: ModuleManifest = {
  id: "academy",
  group: "front-of-house",
  name: "Academy",
  description: "The lifeguard and swim teacher courses we deliver: candidates, checks, registers and results",
  icon: Award,
  href: "/academy",
  logName: "Academy",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the courses at their sites.", permissions: ["academy.read"] },
      { key: "run", label: "Tutor", help: "Add candidates, record checks and payment, take registers and record results.", permissions: ["academy.run"] },
      { key: "manage", label: "Manage", help: "Keep the course list and put courses on, with sessions, tutor and price.", permissions: ["academy.manage"] },
    ],
  },
};
