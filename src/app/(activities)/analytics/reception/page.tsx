import type { Metadata } from "next";
import { DeskReport, getDeskInsights } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Reception · Analytics" };

export default async function ReceptionAnalyticsPage(props: PageProps<"/analytics/reception">) {
  await screenPage("analytics");
  return <DeskReport data={await getDeskInsights(await props.searchParams)} />;
}
