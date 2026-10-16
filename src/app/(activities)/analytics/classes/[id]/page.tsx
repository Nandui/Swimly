import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassDetailReport, getClassInsights } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Class · Analytics" };

export default async function ClassAnalyticsPage(props: PageProps<"/analytics/classes/[id]">) {
  await screenPage("analytics");
  const { id } = await props.params;
  const data = await getClassInsights(id, await props.searchParams);
  if (!data.course) notFound();
  return <ClassDetailReport data={data} />;
}
