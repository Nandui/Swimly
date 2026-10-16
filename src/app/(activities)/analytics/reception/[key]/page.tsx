import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeskPersonReport, getDeskPersonInsights } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Reception person · Analytics" };

export default async function ReceptionPersonAnalyticsPage(props: PageProps<"/analytics/reception/[key]">) {
  await screenPage("analytics");
  const { key } = await props.params;
  const data = await getDeskPersonInsights(decodeURIComponent(key), await props.searchParams);
  if (!data.person) notFound();
  return <DeskPersonReport data={{ ...data, person: data.person }} />;
}
