import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { DayView, planDay } from "@/modules/plan/features/day";

export const metadata: Metadata = { title: "Day" };

/** The Day at one site, every department together: plan it ahead, or run it today. */
export default async function PlanDayPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string }> }) {
  const data = await planDay(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Day"
        description={data.site ? `What's on at ${data.site.name}, who fills it, and each person's duties. Pick a gap to see who could fill it.` : undefined} />}>
      {data.site === null ? <EmptyState icon="building" title="No site to plan" hint="Your role doesn't cover a site where Plan (test) is on." /> : <DayView data={data} />}
    </PageShell>
  );
}
