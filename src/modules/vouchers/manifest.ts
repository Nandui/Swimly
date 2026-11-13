import { Ticket } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Vouchers (owner request, 12 November 2026, D30): the vouchers given to communities and
// organisations at times like Christmas, usually a family swim.
export const vouchersModule: ModuleManifest = {
  id: "vouchers",
  group: "front-of-house",
  name: "Vouchers",
  description: "The vouchers we give to communities and organisations: who got how many, and which have been used",
  icon: Ticket,
  href: "/vouchers/overview",
  logName: "Vouchers",
  access: {
    reach: "sites",
    levels: [
      { key: "redeem", label: "Redeem", help: "Check a voucher's code and mark it as used at their sites.", permissions: ["vouchers.redeem"] },
      { key: "manage", label: "Manage", help: "Also make batches of vouchers for an organisation, print them, cancel them and see which were used.", permissions: ["vouchers.manage"] },
    ],
  },
};
