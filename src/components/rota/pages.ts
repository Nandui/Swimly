import { CalendarDays, CalendarRange, LayoutDashboard, Sun, UserX, type LucideIcon } from "lucide-react";

export type RotaPage = { href: string; label: string; icon: LucideIcon; description: string; match: (pathname: string) => boolean };

/** Rota's pages, once: the page bar (RotaShell) and "Everything in Rota" on the overview are
 *  built from this list, so neither can leave a page out. Absences are for people who run the
 *  rota; the activity list is Admin's (/activity-list). A plain module (no "use client"), so a server page can read it. */
export function rotaPages(run: boolean): RotaPage[] {
  return [
    { href: "/rota/overview", label: "Overview", icon: LayoutDashboard, description: "Today, what waits for you and every Rota page", match: (p) => p === "/rota/overview" },
    { href: "/rota", label: "Plan", icon: CalendarDays, description: "A department's week, day by day: who is on each activity, and every gap", match: (p) => p === "/rota" },
    { href: "/rota/today", label: "Today", icon: Sun, description: "The whole site today: gaps first, who is on, who is off and the changes", match: (p) => p.startsWith("/rota/today") },
    { href: "/rota/bookings", label: "Bookings", icon: CalendarRange, description: "Schools, parties and lane hire that repeat over weeks", match: (p) => p.startsWith("/rota/bookings") },
    ...(run ? [
      { href: "/rota/absences", label: "Absences", icon: UserX, description: "Who is off, and returns to work", match: (p: string) => p.startsWith("/rota/absences") },
    ] : []),
  ];
}
