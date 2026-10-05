import type { Metadata } from "next";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { permissionsOf } from "@/lib/authz";
import { loadModuleOverview } from "@/lib/home";
import { pageSession } from "@/lib/page-guards";
import { visibleScreens } from "@/lib/staff/screens";
import { visibleNavGroups } from "@/modules/activities/lib/nav";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Swim school" };

/** The swim school's first page: the desk's quick actions, today at the
 *  working site, the follow-up queues, and every desk page it can open. */
export default async function SwimSchoolOverviewPage() {
  const session = await pageSession();
  const screens = visibleScreens(permissionsOf(session));
  const { items, siteName } = await loadModuleOverview("swim-school");
  const mod = allModules().find((m) => m.id === "swim-school")!;
  const groups = visibleNavGroups(screens).map((group) => ({
    label: group.label,
    links: group.items.map(({ href, label, icon, description }) => ({ href, label, icon, description })),
  }));
  return <ModuleOverview name={mod.name} description={mod.description} icon={mod.icon} siteName={siteName} items={items} groups={groups} />;
}
