import type { Metadata } from "next";
import { rotaPages } from "@/modules/rota/components/pages";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { loadModuleOverview } from "@/lib/home";
import { requireRotaActor } from "@/modules/rota/lib/access";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: "Rota" };

/** The rota's first page: who is on today, the manager's quick actions, and
 *  the rota's pages. The layout has already checked rota access. */
export default async function RotaOverviewPage() {
  const who = await requireRotaActor();
  const { items, siteName, failed } = await loadModuleOverview("rota");
  const mod = allModules().find((m) => m.id === "rota")!;
  return (
    <ModuleOverview name={mod.name} description={mod.description} icon={mod.icon} siteName={siteName} items={items} failed={failed}
      groups={[{ label: "", links: rotaPages(who.run).filter((page) => page.href !== "/rota/overview").map(({ href, label, icon, description }) => ({ href, label, icon, description })) }]} />
  );
}
