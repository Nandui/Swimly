import { redirect } from "next/navigation";

/** Today is the current day of This week (owner decision, 5 October 2026), where duty managers
 *  see the whole week day by day; old links land on it. */
export default async function TodayPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const { site } = await searchParams;
  redirect(site ? `/rota/day?${new URLSearchParams({ site })}` : "/rota/day");
}
