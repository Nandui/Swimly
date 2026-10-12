import { FilePlus2, LayoutDashboard, ListChecks } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Incidents' pages, once: the page bar (IncidentsShell) and its starter page are built from
 *  this list. A plain module (no "use client"), so a server page can read it. */
export function incidentPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/incidents/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Incidents page", match: (p) => p === "/incidents/overview" },
    { href: "/incidents/new", label: "Report", icon: FilePlus2, description: "Report an accident, an incident or a near miss in two minutes", match: (p) => p.startsWith("/incidents/new") },
    { href: "/incidents", label: "Reports", icon: ListChecks, description: "Your reports and, if you triage, every report at your sites", match: (p) => p === "/incidents" || /^\/incidents\/(?!new|overview)/.test(p) },
  ];
}
