import { CalendarRange, LayoutDashboard, ListChecks } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Short courses' pages, once: the page bar (ShortCoursesShell) and its starter page are built
 *  from this list. A plain module (no "use client"), so a server page can read it. */
export function shortCoursesPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/short-courses/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Short courses page", match: (p) => p === "/short-courses/overview" },
    { href: "/short-courses", label: "Courses", icon: CalendarRange, description: "Courses on and coming up: who is booked, who is waiting, registers and payment", match: (p) => p === "/short-courses" || /^\/short-courses\/(?!types|overview)/.test(p) },
    { href: "/short-courses/types", label: "Course list", icon: ListChecks, description: "The courses we offer, with their weeks and session length", match: (p) => p.startsWith("/short-courses/types") },
  ];
}
