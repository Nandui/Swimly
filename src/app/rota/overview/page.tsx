import type { Metadata } from "next";
import { Building2, CalendarDays, History, Upload, UserX } from "lucide-react";
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
        { href: "/rota", label: "Week", icon: CalendarDays, description: who.manage ? "Plan each site's shifts for the week" : "Each site's shifts for the week" },
        ...(who.manage ? [{ href: "/rota/absences", label: "Absences", icon: UserX, description: "Who is off, now and soon, and the shifts that need cover" }] : []),
      ] }, ...(who.manage ? [{ label: "Roster", links: [
        { href: "/rota/import", label: "Upload roster", icon: Upload, description: "Bring in the week for both sites from the payroll export" },
        { href: "/rota/changes", label: "Roster changes", icon: History, description: "Each upload, and what moved when a week was uploaded again" },
        { href: "/rota/departments", label: "Departments", icon: Building2, description: "Where each roster department works, and its name" },
      ] }] : [])]} />
  );
}
