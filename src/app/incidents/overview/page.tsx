import type { Metadata } from "next";
import { ModuleStart } from "@/components/workspace/module-start";
import { incidentPages, incidentsAccess } from "@/modules/incidents/features/workspace";
import { pageSession } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Incidents" };

/** Incidents' starter page. The layout has already checked Incidents access. */
export default async function IncidentsOverviewPage() {
  const who = incidentsAccess(await pageSession());
  return <ModuleStart id="incidents" groups={[{ label: "", links: incidentPages({ review: who?.review ?? false, signoff: who?.signoff ?? false }) }]} />;
}
