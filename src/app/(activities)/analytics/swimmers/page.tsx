import type { Metadata } from "next";
import { getSwimmerInsights, SwimmersReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Swimmers · Analytics" };

export default async function SwimmersAnalyticsPage(props: PageProps<"/analytics/swimmers">) {
  await screenPage("analytics");
  return <SwimmersReport data={await getSwimmerInsights(await props.searchParams)} />;
}
