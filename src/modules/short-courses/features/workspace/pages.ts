import { Award, CalendarRange, LayoutDashboard, ListChecks, Phone } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Short courses' pages, once: the page bar (ShortCoursesShell) and its starter page are built
 *  from this list. The Academy's lifeguard and swim teacher courses live under /short-courses/academy.
 *  A plain module (no "use client"), so a server page can read it. */
export function shortCoursesPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/short-courses/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Short courses page", match: (p) => p === "/short-courses/overview" },
    { href: "/short-courses", label: "Courses", icon: CalendarRange, description: "Courses on and coming up: who is booked, who is waiting, registers and payment", match: (p) => p === "/short-courses" || /^\/short-courses\/(?!types|overview|academy)/.test(p) },
    { href: "/short-courses/academy", label: "Academy", icon: Award, description: "Lifeguard and swim teacher courses: candidates, checks, registers and results", match: (p) => p === "/short-courses/academy" || /^\/short-courses\/academy\/(?!types|calls)/.test(p) },
    { href: "/short-courses/academy/calls", label: "To call", icon: Phone, description: "People who held an Academy place online, to phone and take payment", match: (p) => p.startsWith("/short-courses/academy/calls") },
    { href: "/short-courses/types", label: "Course list", icon: ListChecks, description: "The courses we offer, with their weeks and session length", match: (p) => p.startsWith("/short-courses/types") },
    { href: "/short-courses/academy/types", label: "Academy list", icon: ListChecks, description: "The Academy courses we deliver, and what each asks of a candidate", match: (p) => p.startsWith("/short-courses/academy/types") },
  ];
}
