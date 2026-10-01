import type { Metadata } from "next";
import { CalendarDays, Clock3, UserX } from "lucide-react";
import { ModuleOverview } from "@/components/workspace/module-overview";
import { loadModuleOverview } from "@/lib/home";
import { requireRotaActor } from "@/lib/rota/access";
import { allModules } from "@/modules/registry";

export const metadata: Metadata = { title: { absolute: "Turnfin Rota" } };

/** The rota's first page: who is on today, the manager's quick actions, and
 *  the rota's pages. The layout has already checked rota access. */
export default async function RotaOverviewPage() {
  const who = await requireRotaActor();
  const { items, siteName } = await loadModuleOverview("rota");
  return (
    <ModuleOverview name="Rota" description="Shifts at the sites you cover, with warnings for expired qualifications and people who are off." icon={allModules().find((m) => m.id === "rota")!.icon} siteName={siteName} items={items}
      groups={[{ label: "", links: [
        { href: "/rota", label: "Week plan", icon: CalendarDays, description: who.manage ? "Plan who does which duty, by department, for the week" : "Who does which duty this week" },
        { href: "/rota/today", label: "Today", icon: Clock3, description: who.manage ? "Run today's plan: cover, unfilled duties and today's changes" : "Today's duties" },
        ...(who.manage ? [{ href: "/rota/absences", label: "Absences", icon: UserX, description: "Who is off, now and soon, and the shifts that need cover" }] : []),
      ] }]} />
  );
}
