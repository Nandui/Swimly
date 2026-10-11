import { FilePenLine, LayoutDashboard, ReceiptText, UserRound } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { RefundActor, RefundListView } from "@/modules/refunds/shared/types";

/** Refunds' pages, once: the page bar (RefundShell) and its starter page are built from this
 *  list. The request views are views of one list, so each names the view it shows. A plain
 *  module (no "use client"), so a server page can read it. */
export function refundPages(who: Pick<RefundActor, "id" | "request">): (ModulePage & { view: RefundListView | "overview" })[] {
  return [
    { view: "overview", href: "/refunds/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Refunds page" },
    { view: "requests", href: "/refunds", label: "Refund requests", icon: ReceiptText, description: "Every request you can see, by status, with the queues to follow up" },
    { view: "mine", href: `/refunds?creator=${encodeURIComponent(who.id)}&status=all`, label: "My requests", icon: UserRound, description: "The requests you logged, whatever their status" },
    ...(who.request ? [{ view: "drafts" as const, href: "/refunds?status=DRAFT", label: "My drafts", icon: FilePenLine, description: "Requests you started and have not sent yet" }] : []),
  ];
}
