import type { Metadata } from "next";
import { getTeacherInsights, TeachersReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Teachers · Analytics" };

export default async function TeachersAnalyticsPage(props: PageProps<"/analytics/teachers">) {
  await screenPage("analytics");
  return <TeachersReport data={await getTeacherInsights(await props.searchParams)} />;
}
