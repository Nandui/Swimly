import { ModuleOverview } from "@/components/workspace/module-overview";
import { loadModuleOverview } from "@/lib/home";
import { allModules, type ModulePage } from "@/modules/registry";

/** A module's starter page: the first page whenever the module is opened from Home or the
 *  module bar (its manifest's `href`). Every module's is the same shape (ModuleOverview):
 *  its quick actions, today and what waits for this person (the items it gives Home's
 *  counts, `registerHomeCard`), then every page it has. The module's layout has already
 *  checked access; each page it lists checks again. */
export async function ModuleStart({ id, groups }: {
  /** The module's manifest id. */
  id: string;
  /** Its pages, from the same list as its page bar; the starter page itself is left out.
   *  One unnamed group for a short list. */
  groups: { label: string; links: readonly ModulePage[] }[];
}) {
  const mod = allModules().find((m) => m.id === id);
  if (!mod) throw new Error(`No module with id "${id}" in src/app/modules.ts`);
  const { items, siteName, failed } = await loadModuleOverview(id);
  const plain = groups.map((group) => ({
    label: group.label,
    links: group.links.filter((link) => link.href !== mod.href).map(({ href, label, icon, description }) => ({ href, label, icon, description })),
  }));
  return <ModuleOverview name={mod.name} description={mod.description} icon={mod.icon} siteName={siteName} items={items} groups={plain} failed={failed} />;
}
