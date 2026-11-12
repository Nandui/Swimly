import "server-only";
import { memberHistoryFor, memberNoticesFor } from "@/modules/contributions";
import { requireActivitiesAccess } from "@/modules/activities/shared/classification";

/** The short courses and Academy courses a swimmer has been booked on, from the modules that run
 *  them (owner request, 21 October 2026). Titles and dates only. */
export async function getSwimmerOtherCourses(id: string) {
  await requireActivitiesAccess();
  return memberHistoryFor(id);
}

/** What other modules need the desk to raise with this swimmer's family, such as a direct debit
 *  that failed and is not recovered yet (Payments). Shown as badges on the profile. */
export async function getSwimmerNotices(id: string) {
  await requireActivitiesAccess();
  return memberNoticesFor(id);
}
