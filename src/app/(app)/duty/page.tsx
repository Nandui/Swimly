import type { Metadata } from "next";
import { DutyView } from "@/components/duty/duty-view";
import { screenPage } from "@/lib/page-guards";
import { getCurrentClub } from "@/lib/clubs/current";
import { can, canSee } from "@/lib/authz";
import { getDutyClasses } from "@/lib/duty/data";
import { today, minutesNow } from "@/lib/format";

export const metadata: Metadata = { title: "Duty manager" };
export default async function DutyPage() {
  const session = await screenPage("duty"), instant = new Date(), iso = today(instant);
  const [{ courses, pending }, { club }] = await Promise.all([getDutyClasses(iso), getCurrentClub()]);
  return <DutyView key={`${club.id}-${iso}`} courses={courses} iso={iso} clubName={club.name} initialNow={minutesNow(instant)}
    canCancel={can(session, "classes.cancel")} canBilling={canSee(session, "cancellations")} pendingBilling={pending} />;
}
