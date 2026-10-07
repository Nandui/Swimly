import type { Metadata } from "next";
import { MultiplePlacesReport } from "@/modules/activities/components/analytics/multiple-places-report";
import { getMultiplePlacesAnalytics } from "@/modules/activities/lib/analytics/report-data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Multiple enrolments" };

export default async function MultiplePlacesAnalyticsPage() {
  await screenPage("analytics");
  return <MultiplePlacesReport data={await getMultiplePlacesAnalytics()} />;
}
