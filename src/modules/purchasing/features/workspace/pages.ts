import { FilePlus2, LayoutDashboard, ReceiptText, Truck } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { PurchasingActor } from "@/modules/purchasing/shared/access";

/** Purchasing's pages, once: the page bar (PurchasingShell) and its starter page are built from
 *  this list. A plain module (no "use client"), so a server page can read it. */
export function purchasingPages(who: Pick<PurchasingActor, "request">): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/purchasing/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Purchasing page", match: (p) => p === "/purchasing/overview" },
    { href: "/purchasing", label: "Orders", icon: ReceiptText, description: "Purchase orders at the sites you cover, from draft to received", match: (p) => p === "/purchasing" || /^\/purchasing\/(?!new|suppliers|overview)/.test(p) },
    ...(who.request ? [{ href: "/purchasing/new", label: "New order", icon: FilePlus2, description: "Raise an order for approved products from an approved supplier", match: (p: string) => p.startsWith("/purchasing/new") }] : []),
    { href: "/purchasing/suppliers", label: "Suppliers", icon: Truck, description: "Approved suppliers, their products and agreed prices", match: (p) => p.startsWith("/purchasing/suppliers") },
  ];
}
