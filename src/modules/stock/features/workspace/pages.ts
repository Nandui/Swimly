import { ArrowLeftRight, ClipboardList, LayoutDashboard, Package, Tags } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Stock's pages, once: the page bar (StockShell) and its starter page are built from this list.
 *  A plain module (no "use client"), so a server page can read it. */
const OWN = /^\/stock\/(overview|products|categories|compare)(\/|$)/;

export function stockPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/stock/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Stock page", match: (p) => p === "/stock/overview" },
    { href: "/stock", label: "Counts", icon: ClipboardList, description: "Start a count at your site, count the shelves and submit it", match: (p) => p === "/stock" || (p.startsWith("/stock/") && !OWN.test(p)) },
    { href: "/stock/compare", label: "Compare", icon: ArrowLeftRight, description: "Two counts at a site side by side: what went down, what went up and what was missed", match: (p) => p.startsWith("/stock/compare") },
    { href: "/stock/products", label: "Products", icon: Package, description: "Everything we count, the unit it is counted in and its category", match: (p) => p.startsWith("/stock/products") },
    { href: "/stock/categories", label: "Categories", icon: Tags, description: "How products are grouped on the count sheet", match: (p) => p.startsWith("/stock/categories") },
  ];
}
