import { LayoutDashboard, TriangleAlert } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Site Monitoring's pages, once: the page bar (MonitoringShell) and its starter page are built
 *  from this list. A plain module (no "use client"), so a server page can read it. */
export function monitoringPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/site-monitoring/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Site Monitoring page", match: (p) => p === "/site-monitoring/overview" },
    { href: "/site-monitoring", label: "Actions", icon: TriangleAlert, description: "Readings out of range at your sites, and what was done about each", match: (p) => p === "/site-monitoring" },
  ];
}
