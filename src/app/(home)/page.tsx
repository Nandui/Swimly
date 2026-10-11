import { HomeView } from "@/components/home/home-view";
import { loadHome } from "@/lib/home";
import { allModules } from "@/modules/registry";

/** Home, the hub: the modules this person's role opens, each going to its starter page. The
 *  frame is the layout's, so `loading.tsx` shows Home's shape while this loads. */
export default async function HomePage() {
  const home = await loadHome();
  // Group by group (MODULE_GROUPS), so Home lists modules in the module bar's order.
  const modules = allModules().filter((m) => home.moduleIds.includes(m.id));
  return <HomeView homeName={home.homeName} roleName={home.roleName} siteName={home.siteName} today={home.today} modules={modules} items={home.items} failed={home.failed} meUrl={home.meUrl} />;
}
