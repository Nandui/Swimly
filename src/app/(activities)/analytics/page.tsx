import type { Metadata } from "next";
import { BusinessReport, getBusinessInsights } from "@/modules/activities/features/analytics";
import { screenPage } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Business · Analytics" };

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  await screenPage("analytics");
  return <BusinessReport data={await getBusinessInsights(await props.searchParams)} />;
}
