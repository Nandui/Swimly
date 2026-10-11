import { BarChart3, Building2, ClipboardList, Flag, History, LayoutDashboard, LayoutGrid } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { TasksActor } from "@/modules/tasks/shared/access";

/** Tasks' pages, once, as the prototype named them: the page bar (TasksShell) and its starter
 *  page are built from this list. A plain module (no "use client"), so a server page can read it. */
export function tasksPages(who: Pick<TasksActor, "manage" | "review">): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/tasks/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Tasks page", match: (p) => p === "/tasks/overview" },
    { href: "/tasks", label: "Today", icon: ClipboardList, description: "A site's tasks for the day: what is due, done and missed", match: (p) => p === "/tasks" || /^\/tasks\/(?!actions|reports|templates|sites|activity|overview)/.test(p) },
    ...(who.manage ? [{ href: "/tasks/templates", label: "Manage tasks", icon: LayoutGrid, description: "Build, schedule and assign the work that keeps your sites running", match: (p: string) => p.startsWith("/tasks/templates") }] : []),
    ...(who.review ? [{ href: "/tasks/reports", label: "Reports", icon: BarChart3, description: "Completion, consistency and the details behind every score", match: (p: string) => p.startsWith("/tasks/reports") }] : []),
    { href: "/tasks/actions", label: "Actions", icon: Flag, description: "Follow-ups raised from tasks: what needs putting right and how it was", match: (p) => p.startsWith("/tasks/actions") },
    { href: "/tasks/sites", label: "Sites", icon: Building2, description: "Working hours and closed dates for each location", match: (p) => p.startsWith("/tasks/sites") },
    ...(who.review ? [{ href: "/tasks/activity", label: "Activity", icon: History, description: "Every change made in Tasks: who did what, where and when", match: (p: string) => p.startsWith("/tasks/activity") }] : []),
  ];
}
