import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { maintenancePages } from "@/modules/maintenance/features/workspace";

export const metadata: Metadata = { title: "Maintenance" };

/** Maintenance's starter page. The layout has already checked Maintenance access. */
export default function MaintenanceOverviewPage() {
  return <ModuleStart id="maintenance" groups={[{ label: "", links: maintenancePages() }]} />;
}
