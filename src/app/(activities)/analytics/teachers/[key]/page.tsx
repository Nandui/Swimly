import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOneTeacherInsights, TeacherDetailReport } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Teacher · Analytics" };

export default async function TeacherAnalyticsPage(props: PageProps<"/analytics/teachers/[key]">) {
  await screenPage("analytics");
  const { key } = await props.params;
  const data = await getOneTeacherInsights(decodeURIComponent(key), await props.searchParams);
  if (!data.detail) notFound();
  return <TeacherDetailReport data={{ ...data, detail: data.detail }} />;
}
