import { CalendarCheck, CalendarDays, CalendarOff, LayoutDashboard, Settings2 } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Plan (test)'s pages, once: the page bar (PlanShell) and its starter page are built from this
 *  list. A plain module (no "use client"), so a server page can read it. */
export function planPages(): (ModulePage & { match: (pathname: string) => boolean; site: boolean })[] {
  return [
    { href: "/plan/overview", label: "Overview", icon: LayoutDashboard, description: "Every Plan (test) page", match: (p) => p === "/plan/overview", site: false },
    { href: "/plan", label: "Week", icon: CalendarDays, description: "A department's people across the week: add shifts, copy last week", match: (p) => p === "/plan", site: true },
    { href: "/plan/day", label: "Day", icon: CalendarCheck, description: "What's on and its gaps, and each person's duties, breaks and tasks; run today from here", match: (p) => p.startsWith("/plan/day"), site: true },
    { href: "/plan/off", label: "Off", icon: CalendarOff, description: "Who is off, so nobody plans them", match: (p) => p.startsWith("/plan/off"), site: true },
    { href: "/plan/setup", label: "Setup", icon: Settings2, description: "Duties, areas and what's on, with what each needs", match: (p) => p.startsWith("/plan/setup"), site: true },
  ];
}
