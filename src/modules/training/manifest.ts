import { GraduationCap } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/apps.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const trainingModule: ModuleManifest = {
  id: "training",
  group: "team",
  name: "Training",
  description: "Training for the people you cover: what is due, waiting for sign-off and done",
  icon: GraduationCap,
  href: "/training/overview",
  logName: "Training",
  access: {
    reach: "sites",
    levels: [
      { key: "trainer", label: "Trainer", help: "Sign off practical training for people at their sites.", permissions: ["training.records.read", "training.signoff"] },
      // Author (owner request, 15 October 2026): builds courses without assigning them.
      { key: "author", label: "Author", help: "Also build courses: write lessons, add videos and files, preview and publish them.", permissions: ["training.manage"] },
      { key: "manage", label: "Manage", help: "Also assign courses to the people they cover and check certificates.", permissions: ["training.assign", "qualifications.manage"] },
    ],
  },
};
