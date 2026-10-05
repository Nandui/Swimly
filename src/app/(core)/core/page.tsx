import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, History, KeyRound, Users } from "lucide-react";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { canSee } from "@/lib/authz";
import { loadModuleOverview } from "@/lib/home";
import { pageSession } from "@/lib/page-guards";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Admin" };

/** Admin's first page: what waits to be checked (details changes sent from
 *  Turnfin Me), and the Admin pages this person can open. Someone who can open
 *  none of them goes Home (their own Account lives outside Admin, at /account);
 *  each page still asks for its own screen and permission. The icons match the
 *  page bar in CoreShell. */
export default async function CoreHome() {
  const session = await pageSession();
  const pages = [
    { screen: "staff", href: "/staff", label: "Staff", icon: Users, description: "Who can sign in, their roles, sites and work devices" },
    { screen: "roles", href: "/roles", label: "Roles", icon: KeyRound, description: "What each role can open and do, module by module" },
    { screen: "clubs", href: "/clubs", label: "Sites", icon: Building2, description: "The sites, and which one this device works at" },
    { screen: "activity", href: "/activity", label: "Activity", icon: History, description: "Who changed what, and when" },
  ] as const;
  const organisation = pages.filter((page) => canSee(session, page.screen)).map(({ href, label, icon, description }) => ({ href, label, icon, description }));
  if (organisation.length === 0) redirect("/");
  const { items, siteName, failed } = await loadModuleOverview("admin");
  const mod = allModules().find((m) => m.id === "admin")!;
  return (
    <ModuleOverview name={mod.name} description={mod.description} icon={mod.icon} siteName={siteName} items={items} failed={failed}
      groups={[{ label: "Organisation", links: organisation }]} />
  );
}
