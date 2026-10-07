import type { Metadata } from "next";
import { MultiplePlacesReport } from "@/modules/activities/components/analytics/multiple-places-report";
import { getMultiplePlacesAnalytics } from "@/modules/activities/lib/analytics/report-data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Multiple enrolments" };

export default async function MultiplePlacesAnalyticsPage(props: PageProps<"/analytics/multiple-places">) {
  await screenPage("analytics");
  const { scope } = await props.searchParams;
  return <MultiplePlacesReport data={await getMultiplePlacesAnalytics(scope === "all" ? "all" : "site")} />;
}
