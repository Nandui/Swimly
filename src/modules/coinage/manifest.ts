import { Coins } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Coinage (owner request, 21 October 2026): change for the tills, sent to
// accounts the way a refund request is.
export const coinageModule: ModuleManifest = {
  id: "coinage",
  group: "front-of-house",
  name: "Coinage",
  description: "Coins for the tills, requested at the desk and ordered by accounts",
  icon: Coins,
  href: "/coinage/overview",
  logName: "Coinage",
  access: {
    reach: "everywhere",
    levels: [
      { key: "use", label: "Use", help: "Request coinage for a till and follow it.", permissions: ["coinage.read", "coinage.request"] },
      { key: "manage", label: "Manage", help: "Decide coinage requests and record the orders. Nobody decides their own.", permissions: ["coinage.review", "coinage.process"] },
    ],
  },
};
