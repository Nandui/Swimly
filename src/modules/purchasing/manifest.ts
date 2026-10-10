import { ShoppingCart } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const purchasingModule: ModuleManifest = {
  id: "purchasing",
  group: "back-office",
  name: "Purchasing",
  description: "Raise purchase orders with approved suppliers, approved by role and amount, numbered per site.",
  icon: ShoppingCart,
  href: "/purchasing",
  logName: "Purchasing",
  access: {
    reach: "sites",
    levels: [
      { key: "view", label: "View", help: "See their sites' orders, and approve those their role may approve.", permissions: ["purchasing.read"] },
      { key: "request", label: "Request", help: "Raise purchase orders at their sites.", permissions: ["purchasing.request"] },
      { key: "manage", label: "Manage", help: "Suppliers, approved products and prices, and who approves up to what.", permissions: ["purchasing.manage"] },
    ],
  },
};
