import { FilePlus2, LayoutDashboard, UserRound, Wrench } from "lucide-react";
import type { ModulePage } from "@/modules/registry";

/** Maintenance's pages, once: the page bar (MaintenanceShell) and its starter page are built from
 *  this list. The lists are views of one page, so each names the view it shows. */
export function maintenancePages(): (ModulePage & { view: "overview" | "requests" | "mine" | "new" })[] {
  return [
    { view: "overview", href: "/maintenance/overview", label: "Overview", icon: LayoutDashboard, description: "What waits for you, and every Maintenance page" },
    { view: "requests", href: "/maintenance", label: "Requests", icon: Wrench, description: "Everything reported at your sites, open first, until it is fixed" },
    { view: "mine", href: "/maintenance?show=mine", label: "Yours", icon: UserRound, description: "The problems you reported, and where each has got to" },
    { view: "new", href: "/maintenance/new", label: "Report a problem", icon: FilePlus2, description: "Something broken or needing repair: say where and what, in a minute" },
  ];
}
