import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { OffList, planOffs } from "@/modules/plan/features/off";

export const metadata: Metadata = { title: "Off" };

/** Who is off at one site. */
export default async function PlanOffPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const data = await planOffs(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Off"
        description={data.site ? `Holidays and days off for people at ${data.site.name}. Absences and returns to work stay in Rota.` : undefined} />}>
      {data.site === null ? <EmptyState icon="building" title="No site to plan" hint="Your role doesn't cover a site where Plan (test) is on." /> : <OffList data={data} />}
    </PageShell>
  );
}
