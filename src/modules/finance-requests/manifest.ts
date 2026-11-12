import { ReceiptText } from "lucide-react";
import type { ModuleManifest } from "@/modules/registry";

/** How this module describes itself to the rest of Turnfin: its name, menu entry, levels and the
 *  permissions each level gives (docs/apps.md). Listed in src/app/modules.ts. Client-safe: menus
 *  and the role editor read it. */
// Finance requests (D24, 2 November 2026): Refunds and Coinage as one app. Reception asks; the
// same finance team decides and pays or orders. Each kind keeps its own tables and permissions.
export const financeRequestsModule: ModuleManifest = {
  id: "finance-requests",
  group: "front-of-house",
  name: "Finance requests",
  description: "Refunds and coinage for the tills, asked for at the desk and decided by finance",
  icon: ReceiptText,
  href: "/finance-requests",
  logName: "Finance requests",
  access: {
    reach: "everywhere",
    levels: [
      { key: "use", label: "Use", help: "Log a customer's refund request or ask for coinage for a till, and follow them.",
        permissions: ["refunds.read", "refunds.request", "coinage.read", "coinage.request"] },
      { key: "manage", label: "Manage", help: "Decide refund and coinage requests, and record payments and orders. Nobody decides their own.",
        permissions: ["refunds.review", "refunds.process", "coinage.review", "coinage.process"] },
    ],
    // Refunds and Coinage had the same level keys; a role's stored level in either counts here.
    formerly: [{ id: "refunds", switch: true }, { id: "coinage", switch: true }],
  },
};
