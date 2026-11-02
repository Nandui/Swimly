import { Landmark } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Payments (owner, 2 November 2026): the direct debits that failed each month, followed up by
// reception until each is recovered.
export const paymentsModule: ModuleManifest = {
  id: "payments",
  group: "front-of-house",
  name: "Payments",
  description: "Failed direct debits, followed up by reception until each is recovered",
  icon: Landmark,
  href: "/payments/overview",
  logName: "Payments",
  access: {
    reach: "sites",
    levels: [
      { key: "use", label: "Use", help: "See the failed direct debits at their sites, log each contact and record how it ended.", permissions: ["payments.read", "payments.follow"] },
      { key: "manage", label: "Manage", help: "Also upload the monthly failure sheet and open closed payments again.", permissions: ["payments.manage"] },
    ],
  },
};
