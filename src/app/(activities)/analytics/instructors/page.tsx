import type { Metadata } from "next";
import { InstructorReport } from "@/modules/activities/components/analytics/instructor-report";
import { getInstructorAnalytics } from "@/modules/activities/lib/analytics/report-data";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Instructor attendance" };

export default async function InstructorAnalyticsPage() {
  await screenPage("analytics");
  return <InstructorReport data={await getInstructorAnalytics()} />;
}
