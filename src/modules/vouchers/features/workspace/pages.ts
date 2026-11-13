import { Gift, LayoutDashboard, Ticket } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** The Vouchers pages, once: the sidebar (VouchersShell) and its starter page are built from this
 *  list. Issued shows only to whoever gives vouchers out. A plain module (no "use client"), so a
 *  server page can read it. */
export function voucherPages(who: { manage: boolean }): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/vouchers/overview", label: "Overview", icon: LayoutDashboard, description: "Every Vouchers page", match: (p) => p === "/vouchers/overview" },
    { href: "/vouchers", label: "Redeem", icon: Ticket, description: "Check the code on a voucher and mark it as used", match: (p) => p === "/vouchers" },
    ...(who.manage ? [{ href: "/vouchers/batches", label: "Issued", icon: Gift, description: "The vouchers given to communities and organisations, and how many were used", match: (p: string) => p.startsWith("/vouchers/batches") }] : []),
  ];
}
