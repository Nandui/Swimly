import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { incidentPages } from "@/modules/incidents/features/workspace";

export const metadata: Metadata = { title: "Incidents" };

/** Incidents' starter page. The layout has already checked Incidents access. */
export default function IncidentsOverviewPage() {
  return <ModuleStart id="incidents" groups={[{ label: "", links: incidentPages() }]} />;
}
