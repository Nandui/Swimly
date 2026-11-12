import type { Metadata } from "next";
import { getProgressionInsights, ProgressionReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Progression · Analytics" };

export default async function ProgressionAnalyticsPage(props: PageProps<"/analytics/progression">) {
  await screenPage("analytics");
  return <ProgressionReport data={await getProgressionInsights(await props.searchParams)} />;
}
