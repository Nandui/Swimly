import { BadgeCheck, BookOpen, ChartColumn, CalendarDays, ClipboardCheck, Grid3x3, LayoutDashboard, ListChecks, Route, Users } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { TrainingActor } from "@/modules/training/shared/access";

/** Training's pages, once: the page bar (TrainingShell) and its starter page are built from this
 *  list. People's views of the people you cover nest under it in the sidebar, like folders. Each appears only for the job the person has; the pages enforce it again and scope
 *  records. A plain module (no "use client"), so a server page can read it. */
export function trainingPages(who: Pick<TrainingActor, "signoff">): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/training/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Training page", match: (p) => p === "/training/overview" },
    { href: "/training", label: "People", folderEntry: "Everyone", icon: Users, description: "Training for the people you cover: what is due, waiting for sign-off and done", match: (p) => p === "/training" || p.startsWith("/training/people/") },
    ...(who.signoff ? [{ href: "/training/sign-off", label: "Sign-off", icon: ClipboardCheck, description: "People who say they are ready, to watch and sign off", match: (p: string) => p.startsWith("/training/sign-off") }] : []),
    { href: "/training/matrix", label: "Matrix", under: "/training", icon: Grid3x3, description: "Everyone you cover against the courses they need, and how many are in date", match: (p) => p.startsWith("/training/matrix") },
    { href: "/training/reports", label: "Reports", icon: ChartColumn, description: "Overdue training by site and by manager, each course's numbers, and downloads for Excel", match: (p) => p.startsWith("/training/reports") },
    { href: "/training/courses", label: "Courses", place: "setup" as const, icon: BookOpen, description: "The courses staff are assigned and complete", match: (p) => p.startsWith("/training/courses") },
    { href: "/training/paths", label: "Learning paths", place: "setup" as const, icon: Route, description: "Courses in order for a new starter or a new role, assigned at once", match: (p) => p.startsWith("/training/paths") },
    { href: "/training/sessions", label: "Sessions", icon: CalendarDays, description: "Classroom and poolside training with places and a register", match: (p) => p.startsWith("/training/sessions") },
    // Checks the code on Training's own completion certificates; certificates people upload are
    // checked in Qualifications (D26).
    { href: "/training/check", label: "Check a certificate", under: "/training", icon: BadgeCheck, description: "Check the code on a certificate from Turnfin Me", match: (p) => p === "/training/check" },
    { href: "/training/rules", label: "Rules", place: "setup" as const, icon: ListChecks, description: "Who must take each course and how often; Turnfin assigns it", match: (p) => p === "/training/rules" },
  ];
}
