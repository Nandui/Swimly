import { Award } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts. Client-safe: menus
 *  and the role editor read it. */
// The Academy (D24, 2 November 2026): the lifeguard and swim teacher courses, its own app again in
// Team, with the Academy booking site's API. It joined Short courses on 15 October 2026 and left
// it with its tables, so the swim school's desk levels never open it.
export const academyModule: ModuleManifest = {
  id: "academy",
  group: "team",
  name: "Academy",
  description: "Lifeguard and swim teacher courses: candidates, checks, payment, registers and results",
  icon: Award,
  href: "/academy/overview",
  logName: "Academy",
  access: {
    reach: "sites",
    levels: [
      { key: "tutor", label: "Tutor", help: "See the Academy courses at their sites: add candidates, record checks and payment, phone people who held a place online, take registers and record results.",
        permissions: ["academy.read", "academy.run"] },
      { key: "manage", label: "Manage", help: "Also keep the Academy course list, and put courses on with their sessions, tutor, places and price.",
        permissions: ["academy.manage"] },
    ],
    // Short courses' Instructor or tutor and Manage carry over (owner default, 3 November 2026); its
    // View gives no Academy level. The old Academy app's keys (before 15 October) count the same way.
    formerly: [
      { id: "short-courses", levels: { run: "tutor", manage: "manage" }, switch: true },
      { id: "academy", levels: { run: "tutor", manage: "manage" } },
    ],
  },
};
