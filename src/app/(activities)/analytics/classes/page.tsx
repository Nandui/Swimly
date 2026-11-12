import type { Metadata } from "next";
import { ClassesReport, getClassesInsights } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Classes · Analytics" };

export default async function ClassesAnalyticsPage(props: PageProps<"/analytics/classes">) {
  await screenPage("analytics");
  return <ClassesReport data={await getClassesInsights(await props.searchParams)} />;
}
