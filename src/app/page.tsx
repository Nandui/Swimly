import type { Metadata } from "next";
import { HomeShell } from "@/components/home/home-shell";
import { HomeView } from "@/components/home/home-view";
import { loadHome } from "@/lib/home";
import { allModules } from "@/modules/registry";
import './docs/docs.css';
import './docs/integration.css';
import './docs/brand.css';
import './workspace/module-workspace.css';

export const metadata: Metadata = { title: { absolute: "Turnfin" }, icons: { icon: "/brand/turnfin.png" } };

/** The front door: the role's home page, which is its workspace. */
export default async function HomePage() {
  const home = await loadHome();
  const modules = allModules().filter((m) => home.moduleIds.includes(m.id));
  return (
    <HomeShell who={home.who} initialCollapsed={home.collapsed}>
      <HomeView homeName={home.homeName} roleName={home.roleName} siteName={home.siteName} today={home.today} modules={modules} items={home.items} />
    </HomeShell>
  );
}
