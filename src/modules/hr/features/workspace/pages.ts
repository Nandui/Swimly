import { ClipboardList, FilePen, History, LayoutDashboard, Settings, Users } from "lucide-react";
import type { ModulePage } from "@/modules/registry";
import type { HrActor } from "@/modules/hr/shared/access";

/** HR's pages, once: the page bar (HrShell) and its starter page are built from this list.
 *  A plain module (no "use client"), so a server page can read it. */
export function hrPages(who: Pick<HrActor, "records" | "reports" | "details" | "superadmin">): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/hr/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every HR page", match: (p) => p === "/hr/overview" },
    ...(who.records ? [{ href: "/hr", label: "People", icon: Users, description: "The people your HR role covers, their records and reviews. Opening a record is logged", match: (p: string) => p === "/hr" || p.startsWith("/hr/people") || p.startsWith("/hr/reviews") }] : []),
    ...(who.reports ? [{ href: "/hr/report", label: "Report", icon: FilePen, description: "Put an issue with someone you manage on their HR file", match: (p: string) => p === "/hr/report" }] : []),
    ...(who.details ? [{ href: "/hr/details-requests", label: "Details changes", icon: ClipboardList, description: "Changes to their details people sent from Turnfin Me", match: (p: string) => p === "/hr/details-requests" }] : []),
    ...(who.superadmin ? [{ href: "/hr/activity", label: "Who read what", icon: History, description: "Every time someone opened an HR record, and every change", match: (p: string) => p === "/hr/activity" }] : []),
    ...(who.superadmin ? [{ href: "/hr/settings", label: "Settings", place: "setup" as const, icon: Settings, description: "Who gets the daily email of yesterday's reports", match: (p: string) => p === "/hr/settings" }] : []),
  ];
}
