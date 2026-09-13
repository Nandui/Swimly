import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/analytics/dashboard";
import { getAnalytics } from "@/lib/analytics/data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await screenPage("analytics");
  return <AnalyticsDashboard data={await getAnalytics()} />;
}
