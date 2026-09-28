import type { Metadata } from "next";
import { InstructorReport } from "@/modules/aquatics/components/analytics/instructor-report";
import { getInstructorAnalytics } from "@/modules/aquatics/lib/analytics/report-data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Instructor attendance · Analytics" };

export default async function InstructorAnalyticsPage() {
  await screenPage("analytics");
  return <InstructorReport data={await getInstructorAnalytics()} />;
}
