import { CalendarRange } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/apps.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
// Short courses (owner decision, 13 October 2026): six and eight
// week courses at the pool, the gym, the studio or anywhere else. The Academy, which joined it on
// 15 October 2026, is its own app again (D24).
export const shortCoursesModule: ModuleManifest = {
  id: "short-courses",
  group: "front-of-house",
  name: "Short courses",
  description: "Six and eight week courses at the pool, the gym or the studio: places, payment, waiting lists and registers",
  icon: CalendarRange,
  href: "/short-courses/overview",
  logName: "Short courses",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the courses at their sites. Book people on short courses: add them, record payment and keep the waiting list.",
        permissions: ["short-courses.read"] },
      { key: "run", label: "Instructor", help: "Also take registers.",
        permissions: ["short-courses.run"] },
      { key: "manage", label: "Manage", help: "Also keep the course list, and put courses on with their sessions, instructor, places and price.",
        permissions: ["short-courses.manage"] },
    ],
  },
};
