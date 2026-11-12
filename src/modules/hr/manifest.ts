import { HeartHandshake } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/apps.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const hrModule: ModuleManifest = {
  id: "hr",
  group: "team",
  name: "HR",
  description: "Restricted staff files: details, employment, notes and performance reviews for the people you look after",
  icon: HeartHandshake,
  href: "/hr/overview",
  logName: "HR",
  access: {
    reach: "everywhere",
    restricted: true,
    levels: [
      // "team" is the stored key of the former "Their team" level, kept so the roles that held it
      // move to Report with no data change (D22).
      { key: "team", label: "Report", help: "File reports on the people they manage. They cannot read files, or their own reports.", reach: "team", permissions: ["hr.reports.write"] },
      {
        key: "sites", label: "Their sites", help: "Staff files, notes, reports and reviews for everyone who works at their sites.", reach: "sites",
        permissions: ["hr.records.read", "hr.details.write", "hr.notes.write", "hr.reviews.write"],
      },
      { key: "all", label: "Everyone", help: "Staff files, notes, reports and reviews for everyone.", permissions: [] },
    ],
    extras: [
      { key: "digest", label: "Keeps the daily reports email", help: "Choose who gets every HR report from the day before, in full, by email each morning (HR > Set up > Settings).", from: "sites", permissions: ["hr.digest.manage"] },
    ],
  },
};
