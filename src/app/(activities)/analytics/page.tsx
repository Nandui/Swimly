import type { Metadata } from "next";
import { AnalyticsDashboard, getAnalytics } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  await screenPage("analytics");
  return <AnalyticsDashboard data={await getAnalytics()} />;
}
