import type { Metadata } from "next";
import { getReceptionAnalytics, ReceptionReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Reception activity" };

export default async function ReceptionAnalyticsPage() {
  await screenPage("analytics");
  return <ReceptionReport data={await getReceptionAnalytics()} />;
}
