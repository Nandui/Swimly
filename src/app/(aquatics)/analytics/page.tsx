import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/modules/aquatics/components/analytics/dashboard";
import { getAnalytics } from "@/modules/aquatics/lib/analytics/data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await screenPage("analytics");
  return <AnalyticsDashboard data={await getAnalytics()} />;
}
