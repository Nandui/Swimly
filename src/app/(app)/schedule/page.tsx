import type { Metadata } from "next";
import { ScheduleCalendar } from "@/components/today/calendar";
import { screenPage } from "@/lib/page-guards";
import { getSchedule } from "@/lib/schedule/data";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  await screenPage("calendar");
  const { date } = await searchParams;
  const data = await getSchedule(date);
  return <ScheduleCalendar key={data.clubId} {...data} />;
}
