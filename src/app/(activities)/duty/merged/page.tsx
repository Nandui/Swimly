import type { Metadata } from "next";
import { getMergedClasses, MergedList } from "@/modules/activities/features/duty";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";

export const metadata: Metadata = { title: "Merged classes" };

/** Every day's merged classes at the site (owner request, 9 November 2026): which class
 *  joined which, who taught them, why, and the swimmers who moved. */
export default async function MergedClassesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await screenPage("duty");
  const requested = Number((await searchParams).page), page = Number.isSafeInteger(requested) && requested > 0 ? requested : 1;
  const [data, { club }] = await Promise.all([getMergedClasses(page), getCurrentClub()]);
  return <MergedList clubName={club.name} page={page} total={data.total} pageSize={data.pageSize}
    rows={data.rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), mergedAt: row.mergedAt.toISOString() }))} />;
}
