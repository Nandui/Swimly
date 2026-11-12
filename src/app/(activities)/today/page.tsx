import { redirect } from "next/navigation";
import { scheduleHref } from "@/modules/activities/features/today";

/** Keep existing bookmarks while Schedule owns the authenticated calendar. */
export default async function TodayRedirect({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const { date } = await searchParams;
  redirect(scheduleHref(date));
}
