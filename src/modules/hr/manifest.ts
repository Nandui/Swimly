import { HeartHandshake } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const hrModule: ModuleManifest = {
  id: "hr",
  group: "team",
  name: "HR",
  description: "Restricted staff files: details, employment, notes and performance reviews for the people you look after",
  icon: HeartHandshake,
  href: "/hr",
  logName: "HR",
  access: {
    reach: "everywhere",
    restricted: true,
    levels: [
      {
        key: "team", label: "Their team", help: "Staff files, notes and reviews for the people they manage.", reach: "team",
        permissions: ["hr.records.read", "hr.details.write", "hr.notes.write", "hr.reviews.write"],
      },
      { key: "all", label: "Everyone", help: "Staff files, notes and reviews for everyone.", permissions: [] },
    ],
  },
};
