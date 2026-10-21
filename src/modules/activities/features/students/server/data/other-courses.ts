import "server-only";
import { memberHistoryFor } from "@/modules/contributions";
import { requireActivitiesAccess } from "@/modules/activities/shared/classification";

/** The short courses and Academy courses a swimmer has been booked on, from the modules that run
 *  them (owner request, 21 October 2026). Titles and dates only. */
export async function getSwimmerOtherCourses(id: string) {
  await requireActivitiesAccess();
  return memberHistoryFor(id);
}
