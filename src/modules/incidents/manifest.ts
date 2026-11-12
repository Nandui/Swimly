import { ShieldAlert } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/apps.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
// Incidents (owner request, 11 October 2026): accidents,
// incidents and near misses, reported, triaged and signed off.
export const incidentsModule: ModuleManifest = {
  id: "incidents",
  group: "poolside",
  name: "Incidents",
  description: "Accidents, incidents and near misses: reported in two minutes, triaged the same day, serious ones signed off",
  icon: ShieldAlert,
  href: "/incidents/overview",
  logName: "Incidents",
  access: {
    reach: "sites",
    levels: [
      { key: "report", label: "Report", help: "Report accidents, incidents and near misses at their sites, and follow their own reports. For duty managers, supervisors, centre managers and operations managers; other staff tell them.", permissions: ["incidents.reports.create"] },
      { key: "investigate", label: "Investigate", help: "Also see every report at their sites, injury details included, get the alert when something serious is reported, triage them and close low-risk ones. Never their own.", permissions: ["incidents.reports.review"] },
      { key: "manage", label: "Manage", help: "Also close serious and moderate reports: the health and safety lead. Never their own.", permissions: ["incidents.reports.signoff"] },
    ],
  },
};
