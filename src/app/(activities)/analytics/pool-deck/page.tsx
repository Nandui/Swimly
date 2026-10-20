import type { Metadata } from "next";
import { getPoolDeckInsights, PoolDeckReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Pool deck · Analytics" };

export default async function PoolDeckAnalyticsPage(props: PageProps<"/analytics/pool-deck">) {
  await screenPage("analytics");
  return <PoolDeckReport data={await getPoolDeckInsights(await props.searchParams)} />;
}
