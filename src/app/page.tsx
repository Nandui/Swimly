import { HomeShell } from "@/components/home/home-shell";
import { HomeView } from "@/components/home/home-view";
import { loadHome } from "@/lib/home";
import { allModules } from "@/modules/registry";
import { dailyPages, SwimSchoolTools } from "@/modules/server";
import './workspace/module-workspace.css';

/** The front door: the role's home page, which is its workspace. With the swim school, the
 *  top row is the swim school's (Today and its daily pages, swimmer search and the site
 *  picker), through the composition root; otherwise the site picker alone. */
export default async function HomePage() {
  const home = await loadHome();
  const modules = allModules().filter((m) => home.moduleIds.includes(m.id));
  const swim = home.moduleIds.includes("swim-school");
  const tools = swim && home.sites ? <SwimSchoolTools screens={home.screens} club={home.sites.club} clubs={home.sites.clubs} /> : undefined;
  return (
    <HomeShell who={home.who} sites={home.sites} tools={tools} pages={swim ? dailyPages(home.screens) : []}>
      <HomeView homeName={home.homeName} roleName={home.roleName} siteName={home.siteName} today={home.today} modules={modules} items={home.items} failed={home.failed} meUrl={home.meUrl} />
    </HomeShell>
  );
}
