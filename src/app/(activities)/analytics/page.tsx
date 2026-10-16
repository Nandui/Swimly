import type { Metadata } from "next";
import { getOverviewInsights, OverviewReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  await screenPage("analytics");
  return <OverviewReport data={await getOverviewInsights(await props.searchParams)} />;
}
