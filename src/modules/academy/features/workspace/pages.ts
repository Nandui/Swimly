import { CalendarRange, LayoutDashboard, ListChecks, Phone } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** The Academy's pages, once: the page bar (AcademyShell) and its starter page are built from
 *  this list. A plain module (no "use client"), so a server page can read it. */
export function academyPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/academy/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Academy page", match: (p) => p === "/academy/overview" },
    { href: "/academy", label: "Courses", icon: CalendarRange, description: "Lifeguard and swim teacher courses: candidates, checks, registers and results", match: (p) => p === "/academy" || /^\/academy\/(?!types|calls|overview)/.test(p) },
    { href: "/academy/calls", label: "To call", icon: Phone, description: "People who held a place online, to phone and take payment", match: (p) => p.startsWith("/academy/calls") },
    { href: "/academy/types", label: "Course list", icon: ListChecks, description: "The courses we deliver, and what each asks of a candidate", match: (p) => p.startsWith("/academy/types") },
  ];
}
