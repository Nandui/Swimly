import { FileBadge, Hourglass, LayoutDashboard, Timer } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Qualifications' pages, once: the page bar (QualificationsShell) and its starter page are built
 *  from this list. A plain module (no "use client"), so a server page can read it. */
export function qualificationsPages(): (ModulePage & { match: (pathname: string) => boolean })[] {
  return [
    { href: "/staff-qualifications/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Qualifications page", match: (p) => p === "/staff-qualifications/overview" },
    { href: "/staff-qualifications", label: "Expiring", icon: Hourglass, description: "Qualifications that run out soon, for the people you cover, with the course that renews each", match: (p) => p === "/staff-qualifications" },
    { href: "/staff-qualifications/certificates", label: "Certificates to check", icon: FileBadge, description: "Certificates uploaded in Turnfin Me, to check and record", match: (p) => p.startsWith("/staff-qualifications/certificates") },
    { href: "/staff-qualifications/hours", label: "In-service hours", icon: Timer, description: "Training hours against what each qualification needs, such as a lifeguard's 20 a year", match: (p) => p.startsWith("/staff-qualifications/hours") },
  ];
}
