import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { monitoringPages } from "@/modules/site-monitoring/features/workspace";

export const metadata: Metadata = { title: "Site Monitoring" };

/** Site Monitoring's starter page. The layout has already checked access. */
export default function SiteMonitoringOverviewPage() {
  return <ModuleStart id="site-monitoring" groups={[{ label: "", links: monitoringPages() }]} />;
}
