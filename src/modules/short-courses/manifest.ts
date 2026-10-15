import { CalendarRange } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
// Short courses (owner decision, 13 October 2026; docs/short-courses.md): six and eight
// week courses at the pool, the gym, the studio or anywhere else. The Academy's lifeguard and
// swim teacher courses joined it (owner decision, 15 October 2026; docs/academy.md, ADR 0011).
// Each level gives both kinds of course their own permissions, so each keeps its rules.
export const shortCoursesModule: ModuleManifest = {
  id: "short-courses",
  group: "front-of-house",
  name: "Short courses",
  description: "Six and eight week courses and the Academy's lifeguard and swim teacher courses: places, payment, registers and results",
  icon: CalendarRange,
  href: "/short-courses/overview",
  logName: "Short courses",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the courses at their sites. Book people on short courses: add them, record payment and keep the waiting list.",
        permissions: ["short-courses.read", "academy.read"] },
      { key: "run", label: "Instructor or tutor", help: "Also take registers, and on Academy courses add candidates, record checks and payment, and record results.",
        permissions: ["short-courses.run", "academy.run"] },
      { key: "manage", label: "Manage", help: "Also keep both course lists, and put courses on with their sessions, instructor or tutor, places and price.",
        permissions: ["short-courses.manage", "academy.manage"] },
    ],
    formerly: ["academy"],
  },
};
