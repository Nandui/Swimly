import { HomeShell } from "@/components/home/home-shell";
import { HomeView } from "@/components/home/home-view";
import { loadHome } from "@/lib/home";
import { allModules } from "@/modules/registry";
import './workspace/module-workspace.css';

/** The front door: the role's home page, which is its workspace. */
export default async function HomePage() {
  const home = await loadHome();
  const modules = allModules().filter((m) => home.moduleIds.includes(m.id));
  return (
    <HomeShell who={home.who} sites={home.sites}>
      <HomeView homeName={home.homeName} roleName={home.roleName} siteName={home.siteName} today={home.today} modules={modules} items={home.items} />
    </HomeShell>
  );
}
