import { ShieldCheck } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Risk assessments (owner, 10 November 2026, D29): the hazards of each area, job and activity at
// a site, what controls them, who signed that off and when each is next reviewed.
export const riskModule: ModuleManifest = {
  id: "risk",
  group: "managers",
  name: "Risk assessments",
  description: "The hazards of each area, job and activity at a site, what controls them and when each is next reviewed",
  icon: ShieldCheck,
  href: "/risk-assessments/overview",
  logName: "Risk assessments",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "Read the risk assessments at their sites, drafts apart, and ask for one to be reviewed.", permissions: ["risk.read"] },
      { key: "write", label: "Write", help: "Also write and change assessments and their hazards, send them for sign-off, sign off the ones they own, log reviews and answer review requests.", permissions: ["risk.write"] },
      { key: "manage", label: "Manage", help: "Also archive assessments and bring them back.", permissions: ["risk.manage"] },
    ],
    extras: [
      { key: "signoff", label: "Can give the executive sign-off", help: "Add the executive sign-off to an assessment its owner has signed off. Never on one they own.", from: "view", permissions: ["risk.signoff"] },
    ],
  },
};
