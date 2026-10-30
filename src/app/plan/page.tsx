import type { Metadata } from "next";
import { EmptyState } from "@/components/ui-kit/empty-state";
import { PageHeader } from "@/components/ui-kit/page-header";
import { PageShell } from "@/components/ui-kit/page-shell";
import { planWeek, WeekView } from "@/modules/plan/features/week";

export const metadata: Metadata = { title: "Week" };

/** The Week: who works when, for one department at one site. */
export default async function PlanWeekPage({ searchParams }: { searchParams: Promise<{ site?: string; week?: string; dept?: string }> }) {
  const data = await planWeek(await searchParams);
  return (
    <PageShell spacing="roomy" header={<PageHeader title="Week"
        description={data.site ? `Shifts at ${data.site.name}${"department" in data && data.department ? ` for ${data.department.name}` : ""}. Open a day to give people their duties.` : undefined} />}>
      {data.site === null ? <EmptyState icon="building" title="No site to plan" hint="Your role doesn't cover a site where Plan (test) is on." /> : <WeekView data={data} />}
    </PageShell>
  );
}
