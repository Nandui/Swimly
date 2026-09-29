import type { Metadata } from "next";
import { Activity, Building2, KeyRound, UserCog, UserRound } from "lucide-react";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { canSee } from "@/lib/authz";
import { loadModuleOverview } from "@/lib/home";
import { pageSession } from "@/lib/page-guards";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Admin" };

/** Admin's first page: what waits to be checked (details changes sent from
 *  Turnfin Me), and the Admin pages this person can open. Account is always
 *  there; each page still asks for its own screen and permission. */
export default async function CoreHome() {
  const session = await pageSession();
  const { items, siteName } = await loadModuleOverview("admin");
  const mod = allModules().find((m) => m.id === "admin")!;
  const pages = [
    { screen: "staff", href: "/staff", label: "Staff", icon: UserCog, description: "Who can sign in, their roles, sites and work devices" },
    { screen: "roles", href: "/roles", label: "Roles", icon: KeyRound, description: "What each role can open and do, module by module" },
    { screen: "clubs", href: "/clubs", label: "Clubs", icon: Building2, description: "The sites, and which one this device works at" },
    { screen: "activity", href: "/activity", label: "Activity", icon: Activity, description: "Who changed what, and when" },
  ] as const;
  const organisation = pages.filter((page) => canSee(session, page.screen)).map(({ href, label, icon, description }) => ({ href, label, icon, description }));
  return (
    <ModuleOverview name={mod.name} description="People, roles and clubs, and the activity log, shared by every module." icon={mod.icon} siteName={siteName} items={items}
      groups={[
        { label: organisation.length ? "Organisation" : "", links: organisation },
        { label: "You", links: [{ href: "/account", label: "Account", icon: UserRound, description: "Your password, PIN and appearance" }] },
      ]} />
  );
}
