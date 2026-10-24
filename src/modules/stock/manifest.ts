import { Boxes } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts.
 *  Client-safe: menus and the role editor read it. */
// Stock (owner decision, 13 October 2026): stock taking, ported from Stockly.
export const stockModule: ModuleManifest = {
  id: "stock",
  group: "back-office",
  name: "Stock",
  description: "Count what is on the shelf at each site, keep the product list and compare two counts",
  icon: Boxes,
  href: "/stock/overview",
  logName: "Stock",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See the counts at their sites, the product list and how two counts compare.", permissions: ["stock.read"] },
      { key: "count", label: "Count", help: "Also start a count at their sites, count the products and submit it.", permissions: ["stock.count"] },
      { key: "manage", label: "Manage", help: "Also keep the product list and its categories, and delete a count.", permissions: ["stock.manage"] },
    ],
  },
};
