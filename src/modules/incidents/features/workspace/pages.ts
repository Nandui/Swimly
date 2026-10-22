import { ChartColumn, FilePlus2, LayoutDashboard, ListChecks, Settings } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Incidents' pages, once: the page bar (IncidentsShell) and its starter page are built from
 *  this list. A plain module (no "use client"), so a server page can read it. Insights is
 *  only for those who triage and Settings only for Manage; each page checks too. */
export function incidentPages(who: { review: boolean; signoff?: boolean }): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/incidents/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Incidents page", match: (p) => p === "/incidents/overview" },
    { href: "/incidents/new", label: "Report", icon: FilePlus2, description: "Report an accident, an incident or a near miss in two minutes", match: (p) => p.startsWith("/incidents/new") },
    { href: "/incidents", label: "Reports", icon: ListChecks, description: "Your reports and, if you triage, every report at your sites", match: (p) => p === "/incidents" || /^\/incidents\/(?!new|overview|insights|settings)/.test(p) },
    ...(who.review ? [{ href: "/incidents/insights", label: "Insights", icon: ChartColumn, description: "Trends by month, kind, place and time of day at your sites", match: (p: string) => p.startsWith("/incidents/insights") }] : []),
    ...(who.signoff ? [{ href: "/incidents/settings", label: "Settings", icon: Settings, description: "Who gets requests to HR", match: (p: string) => p.startsWith("/incidents/settings") }] : []),
  ];
}
