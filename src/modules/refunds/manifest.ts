import { ReceiptText } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry,
 *  levels and the permissions each level gives (docs/how-turnfin-works.md). Listed
 *  in src/app/modules.ts. Client-safe: menus and the role editor read it. */
export const refundsModule: ModuleManifest = {
  id: "refunds",
  group: "front-of-house",
  name: "Refunds",
  description: "Customer refund requests, finance decisions and completed payments",
  icon: ReceiptText,
  href: "/refunds",
  logName: "Refunds",
  access: {
    reach: "everywhere",
    levels: [
      { key: "use", label: "Use", help: "Log a customer's refund request and follow it.", permissions: ["refunds.read", "refunds.request"] },
      { key: "manage", label: "Manage", help: "Decide refund requests and record payments. Nobody decides their own.", permissions: ["refunds.review", "refunds.process"] },
    ],
  },
};
