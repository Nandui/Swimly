import { Coins, FilePenLine, LayoutDashboard, ReceiptText, UserRound } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { FinanceActor } from "@/modules/finance-requests/shared/access";

/** The views the frame marks: the overview, and each kind's request views. */
export type FinanceView = "overview" | `refunds:${"requests" | "mine" | "drafts"}` | `coinage:${"requests" | "mine" | "drafts"}`;

/** Finance requests' pages, once: the page bar (FinanceShell) and its starter page are built from
 *  this list. Each kind's request views are views of one list, so each names the view it shows.
 *  Drafts nest under their kind, keeping the sidebar to five work pages (D19). A plain module (no
 *  "use client"), so a server page can read it. */
export function financePages(who: Pick<FinanceActor, "id" | "refunds" | "coinage">): (ModulePage & { view: FinanceView })[] {
  const mine = encodeURIComponent(who.id);
  return [
    { view: "overview", href: "/finance-requests", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Finance requests page" },
    ...(who.refunds ? [
      { view: "refunds:requests" as const, href: "/refunds", label: "Refunds", folderEntry: "All refunds", icon: ReceiptText, description: "Every refund request you can see, by status, with the queues to follow up" },
      { view: "refunds:mine" as const, href: `/refunds?creator=${mine}&status=all`, label: "My refunds", icon: UserRound, description: "The refund requests you logged, whatever their status" },
    ] : []),
    ...(who.coinage ? [
      { view: "coinage:requests" as const, href: "/coinage", label: "Coinage", folderEntry: "All coinage", icon: Coins, description: "Every coinage request you can see, by status, with the queues to follow up" },
      { view: "coinage:mine" as const, href: `/coinage?creator=${mine}&status=all`, label: "My coinage", icon: UserRound, description: "The coinage requests you made, whatever their status" },
    ] : []),
    ...(who.refunds?.request ? [{ view: "refunds:drafts" as const, href: "/refunds?status=DRAFT", label: "Refund drafts", under: "/refunds", icon: FilePenLine, description: "Refund requests you started and have not sent yet" }] : []),
    ...(who.coinage?.request ? [{ view: "coinage:drafts" as const, href: "/coinage?status=DRAFT", label: "Coinage drafts", under: "/coinage", icon: FilePenLine, description: "Coinage requests you started and have not sent yet" }] : []),
  ];
}
