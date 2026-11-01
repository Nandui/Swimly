import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { planSetup, SetupView } from "@/modules/plan/features/setup";

export const metadata: Metadata = { title: "Setup" };

/** Plan (test)'s setup at one site. */
export default async function PlanSetupPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await planSetup(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Setup"
        description="The duties people do, the areas, and what's on with the staff it needs. Gaps on the Day come from here." />}>
      {data.site === null ? <EmptyState icon="building" title="No site to plan" hint="Your role doesn't cover a site where Plan (test) is on." /> : <SetupView data={data} />}
    </PageShell>
  );
}
