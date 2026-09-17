import type { Metadata } from "next";
import { ReceptionReport } from "@/components/analytics/reception-report";
import { getReceptionAnalytics } from "@/lib/analytics/report-data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Reception activity · Analytics" };

export default async function ReceptionAnalyticsPage() {
  await screenPage("analytics");
  return <ReceptionReport data={await getReceptionAnalytics()} />;
}
