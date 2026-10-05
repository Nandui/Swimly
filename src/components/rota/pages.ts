import { CalendarDays, CalendarRange, GanttChart, LayoutDashboard, UserX, type LucideIcon } from "lucide-react";

export type RotaPage = { href: string; label: string; icon: LucideIcon; description: string; match: (pathname: string) => boolean };

/** Rota's pages, once: the page bar (RotaShell) and "Everything in Rota" on the overview are
 *  built from this list, so neither can leave a page out. Absences are for rota managers.
 *  A plain module (no "use client"), so a server page can read it. */
export function rotaPages(manage: boolean): RotaPage[] {
  return [
    { href: "/rota/overview", label: "Overview", icon: LayoutDashboard, description: "Today, what waits for you and every Rota page", match: (p) => p === "/rota/overview" },
    { href: "/rota", label: "Week plan", icon: CalendarDays, description: "Each department's week: its people, their shifts and its activities", match: (p) => p === "/rota" },
    { href: "/rota/day", label: "This week", icon: GanttChart, description: "Everything on each day, when and who, with changes", match: (p) => p.startsWith("/rota/day") },
    { href: "/rota/bookings", label: "Bookings", icon: CalendarRange, description: "Schools, parties and lane hire that need staff", match: (p) => p.startsWith("/rota/bookings") },
    ...(manage ? [{ href: "/rota/absences", label: "Absences", icon: UserX, description: "Who is off, and returns to work", match: (p: string) => p.startsWith("/rota/absences") }] : []),
  ];
}
