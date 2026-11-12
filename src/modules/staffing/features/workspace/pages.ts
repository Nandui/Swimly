import { CalendarCheck, CalendarRange, GraduationCap, LayoutDashboard, LayoutGrid, Repeat, Settings2, ShieldAlert, Users } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Staffing's pages, once: the page bar (StaffingShell) and its starter page are built from this
 *  list. A plain module (no "use client"), so a server page can read it. */
export function staffingPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/staffing/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Staffing page", match: (p) => p === "/staffing/overview" },
    { href: "/staffing", label: "Blocks", icon: CalendarRange, description: "Two-week rota blocks: build from the slots, fill contracted hours, publish and track acknowledgements", match: (p) => p === "/staffing" || p.startsWith("/staffing/blocks") },
    { href: "/staffing/today", label: "Today", icon: CalendarCheck, description: "The duty manager's day: log call-offs, late arrivals and no-shows, and cover the gaps", match: (p) => p.startsWith("/staffing/today") },
    { href: "/staffing/requests", label: "Requests", icon: Repeat, description: "Swaps and exam absences, with the exam seasons and their deadlines", match: (p) => p.startsWith("/staffing/requests") },
    { href: "/staffing/strikes", label: "Strikes", icon: ShieldAlert, description: "Return-to-work chats, signed notes and referrals, and each person's strikes this semester", match: (p) => p.startsWith("/staffing/strikes") },
    { href: "/staffing/slots", label: "Slots", place: "setup" as const, icon: LayoutGrid, description: "Each site's weekly places to fill: when, what role and how many", match: (p) => p.startsWith("/staffing/slots") },
    { href: "/staffing/staff", label: "Staff", place: "setup" as const, icon: Users, description: "Who is on the rota (swim teachers and lifeguards), their college and their contract", match: (p) => p.startsWith("/staffing/staff") },
    { href: "/staffing/seasons", label: "Exam seasons", place: "setup" as const, icon: GraduationCap, description: "Each college's exam seasons and the absence deadlines they give", match: (p) => p.startsWith("/staffing/seasons") },
    { href: "/staffing/settings", label: "Settings", place: "setup" as const, icon: Settings2, description: "The numbers the rules use: deadlines, notice, rest, the weekly cap and the strike date", match: (p) => p.startsWith("/staffing/settings") },
  ];
}
