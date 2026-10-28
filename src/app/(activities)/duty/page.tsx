import type { Metadata } from "next";
import { DutyView, dutyDate, getDutyClasses } from "@/modules/activities/features/duty";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";
import { can, canSee } from "@/lib/authz";
import { today, minutesNow } from "@/lib/format";

export const metadata: Metadata = { title: "Duty manager" };
export default async function DutyPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const session = await screenPage("duty"), instant = new Date(), todayIso = today(instant), { date } = await searchParams;
  const iso = dutyDate(date, todayIso);
  const [{ courses, pending }, { club }] = await Promise.all([getDutyClasses(iso, instant), getCurrentClub()]);
  return <DutyView key={`${club.id}-${iso}`} courses={courses} iso={iso} todayIso={todayIso} clubName={club.name} initialNow={minutesNow(instant)}
    canCancel={can(session, "classes.cancel")} canBilling={canSee(session, "cancellations")} pendingBilling={pending} />;
}
