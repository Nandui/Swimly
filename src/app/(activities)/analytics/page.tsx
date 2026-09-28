import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/modules/activities/components/analytics/dashboard";
import { getAnalytics } from "@/modules/activities/lib/analytics/data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await screenPage("analytics");
  return <AnalyticsDashboard data={await getAnalytics()} />;
}
