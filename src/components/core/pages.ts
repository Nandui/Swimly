import { Building2, GraduationCap, History, KeyRound, LayoutDashboard, ListChecks, MapPin, Users, UsersRound, type LucideIcon } from "lucide-react";

/** Admin's pages, once, grouped by topic (owner decision, 7 October 2026): the page bar
 *  (CoreShell) and the overview are built from this list. A plain module, so server pages read it. */
export type CoreLinkKey = "staff" | "roles" | "departments" | "clubs" | "areas" | "activity-list" | "qualifications" | "activity";
export type AdminPage = { key: CoreLinkKey | "overview"; href: string; label: string; icon: LucideIcon; description: string };

export const ADMIN_GROUPS: { label: string; links: AdminPage[] }[] = [
  { label: "", links: [{ key: "overview", href: "/core", label: "Overview", icon: LayoutDashboard, description: "What waits to be checked, and every Admin page" }] },
  { label: "People", links: [
    { key: "staff", href: "/staff", label: "Staff", icon: Users, description: "Who can sign in, their roles, sites and work devices" },
    { key: "roles", href: "/roles", label: "Roles", icon: KeyRound, description: "What each role can open and do, module by module" },
    { key: "departments", href: "/departments", label: "Departments", icon: UsersRound, description: "The teams people work in; every activity belongs to one" },
  ] },
  { label: "Places", links: [
    { key: "clubs", href: "/clubs", label: "Sites", icon: Building2, description: "The sites, their short codes, and which one this device works at" },
    { key: "areas", href: "/areas", label: "Areas", icon: MapPin, description: "Each site's pools, gym and reception, for the rota and swim classes" },
  ] },
  { label: "Work", links: [
    { key: "activity-list", href: "/activity-list", label: "Activities", icon: ListChecks, description: "What the rota plans and covers, and the qualification each needs" },
    { key: "qualifications", href: "/qualifications", label: "Qualifications", icon: GraduationCap, description: "The certificates staff can hold, and how long they last" },
  ] },
  { label: "Log", links: [
    { key: "activity", href: "/activity", label: "Activity log", icon: History, description: "Who changed what, and when" },
  ] },
];
