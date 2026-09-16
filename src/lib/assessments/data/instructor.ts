import { screenPage } from "@/lib/page-guards";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly, today } from "@/lib/format";
import { getAssessmentSession } from "@/lib/assessments/data/assessments";

/** Guard before the roster query; a guessed URL cannot cross site/date boundaries. */
export async function getInstructorAssessmentSession(id: string) {
  await screenPage("instructor", "assessments.run");
  return getAssessmentSession(id, {
    clubId: await currentClubId(),
    date: parseDateOnly(today()),
    cancelledAt: null,
  });
}
