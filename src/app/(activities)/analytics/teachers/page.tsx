import { redirect } from "next/navigation";
import { screenPage } from "@/lib/page-guards";

/** Every teacher now sits on the pool deck dashboard; old links land there with their filters. */
export default async function TeachersAnalyticsPage(props: PageProps<"/analytics/teachers">) {
  await screenPage("analytics");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await props.searchParams)) for (const v of [value].flat()) if (v !== undefined) params.append(key, v);
  const query = params.toString();
  redirect(`/analytics/pool-deck${query ? `?${query}` : ""}#teachers`);
}
