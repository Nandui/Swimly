import type { Metadata } from "next";
import { getInstructorAnalytics, InstructorReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Instructor attendance" };

export default async function InstructorAnalyticsPage() {
  await screenPage("analytics");
  return <InstructorReport data={await getInstructorAnalytics()} />;
}
