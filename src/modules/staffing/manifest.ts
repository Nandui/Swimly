import { CalendarRange } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How Staffing describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts. Client-safe. */
// Staffing (4 November 2026; lifeguards from 9 November): part-time pool staff, swim teachers and lifeguards, rostered on their contracts (docs/staffing.md).
export const staffingModule: ModuleManifest = {
  id: "staffing",
  group: "team",
  name: "Staffing",
  description: "Swim teacher and lifeguard rota blocks on contracted hours, swaps, call-offs, strikes and exam seasons",
  icon: CalendarRange,
  href: "/staffing/overview",
  logName: "Staffing",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the rota blocks, today's shifts, swaps and exam absences at their sites.", permissions: ["staffing.read"] },
      { key: "run", label: "Run", help: "Also log call-offs, late arrivals and no-shows, cover gaps, see strikes and hold return-to-work chats (duty manager).", permissions: ["staffing.run"] },
      { key: "supervise", label: "Supervise", help: "Also keep the slots and the staff on the rota, build and publish blocks, decide swaps and exam absences, and hold second strike conversations (pool deck supervisor).", permissions: ["staffing.supervise"] },
      { key: "manage", label: "Manage", help: "Also change published shifts, handle formal and no-show referrals, and keep the exam seasons and settings (centre manager).", permissions: ["staffing.manage"] },
    ],
  },
};
