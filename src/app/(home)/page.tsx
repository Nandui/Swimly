import { HomeView } from "@/components/home/home-view";
import { loadHome } from "@/lib/home";
import { allModules } from "@/modules/registry";

/** Home: what needs this person across their apps, then what is happening now (HomeView). The
 *  frame is the layout's, so `loading.tsx` shows Home's shape while this loads. */
export default async function HomePage() {
  const home = await loadHome();
  // In the module bar's order (MODULE_GROUPS), so Home's lines follow the sidebar's.
  const modules = allModules().filter((m) => home.moduleIds.includes(m.id));
  const firstName = home.who.name.trim().split(/\s+/)[0] || home.who.name;
  return <HomeView firstName={firstName} roleName={home.homeName} siteName={home.siteName} today={home.today} now={home.now} modules={modules} items={home.items} failed={home.failed} meUrl={home.meUrl} />;
}
