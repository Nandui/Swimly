import { BadgeCheck } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts. Client-safe: menus
 *  and the role editor read it. */
// Qualifications (D26, 3 November 2026): checking certificates, what is expiring and in-service
// hours left Training, which now only sets up learning. The records are the platform's.
export const qualificationsModule: ModuleManifest = {
  id: "qualifications",
  group: "team",
  name: "Qualifications",
  description: "Staff qualifications: certificates to check, what is expiring and in-service hours",
  icon: BadgeCheck,
  href: "/staff-qualifications/overview",
  logName: "Qualifications",
  access: {
    reach: "sites",
    levels: [
      { key: "keep", label: "Keep", help: "Check certificates uploaded in Turnfin Me, see what is expiring and log in-service hours for people at their sites.",
        permissions: ["qualifications.manage"] },
    ],
    // Training's Manage checked certificates before D26, so it counts here as Keep, and the app
    // follows Training's switch until it has its own.
    formerly: [{ id: "training", levels: { manage: "keep" }, switch: true }],
  },
};
