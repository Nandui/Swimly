import { Coins, FilePenLine, LayoutDashboard, UserRound } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { CoinageActor, CoinageListView } from "@/modules/coinage/shared/types";

/** Coinage's pages, once: the page bar (CoinageShell) and its starter page are built from this
 *  list. The request views are views of one list, so each names the view it shows. */
export function coinagePages(who: Pick<CoinageActor, "id" | "request">): (ModulePage & { view: CoinageListView | "overview" })[] {
  return [
    { view: "overview", href: "/coinage/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Coinage page" },
    { view: "requests", href: "/coinage", label: "Coinage requests", icon: Coins, description: "Every request you can see, by status, with the queues to follow up" },
    { view: "mine", href: `/coinage?creator=${encodeURIComponent(who.id)}&status=all`, label: "My requests", icon: UserRound, description: "The requests you made, whatever their status" },
    ...(who.request ? [{ view: "drafts" as const, href: "/coinage?status=DRAFT", label: "My drafts", icon: FilePenLine, description: "Requests you started and have not sent yet" }] : []),
  ];
}
