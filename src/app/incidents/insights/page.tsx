import type { Metadata } from "next";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { incidentInsights, Insights } from "@/modules/incidents/features/insights";

export const metadata: Metadata = { title: "Incident insights" };

/** Trends for those who triage; a 404 for everyone else. */
export default async function IncidentInsightsPage({ searchParams }: { searchParams: Promise<{ months?: string; site?: string }> }) {
  const data = await incidentInsights(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Insights" description={`What was reported ${data.site ? `at ${data.site.name}` : "at your sites"} over the last ${data.months} months, to see where to act before someone is hurt.`} />}>
      <Insights data={data} />
    </PageShell>
  );
}
