import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { DayNewView, planDay } from "@/modules/plan/features/day";

export const metadata: Metadata = { title: "Day (new)" };

/** Day (new): the same day as the Day, one department at a time, built from what it needs. It is
 *  on trial beside the Day (owner, 17 November 2026); the two read and change the same plan. */
export default async function PlanDayNewPage({ searchParams }: { searchParams: Promise<{ site?: string; date?: string; dept?: string }> }) {
  const data = await planDay(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Day (new)"
        description={data.site ? `${data.site.name}, one department at a time: what it needs, who is on it and who is in. Pick any block to change it.` : undefined} />}>
      {data.site === null ? <EmptyState icon="building" title="No site to plan" hint="Your role doesn't cover a site where Plan (test) is on." /> : <DayNewView data={data} />}
    </PageShell>
  );
}
