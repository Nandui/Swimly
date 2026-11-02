import { FileUp, LayoutDashboard, Landmark } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Payments' pages, once: the page bar (PaymentsShell) and its starter page are built from this
 *  list. The upload is Manage's, so it is listed only for them. */
export function paymentsPages(who: { manage: boolean }): (ModulePage & { view: "overview" | "failures" | "upload" })[] {
  return [
    { view: "overview", href: "/payments/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Payments page" },
    { view: "failures", href: "/payments", label: "Failed payments", icon: Landmark, description: "Every failed direct debit at your sites, to contact first, until it is recovered" },
    ...(who.manage ? [{ view: "upload" as const, href: "/payments/upload", label: "Upload the sheet", icon: FileUp, description: "The bank's monthly failure sheet: each new failed debit goes on the list" }] : []),
  ];
}
