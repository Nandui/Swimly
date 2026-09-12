import { classPage } from "@/lib/page-guards";
import { getCourse } from "@/lib/courses/data/courses";
import { getCurrentClub } from "@/lib/clubs/current";
import { getClassCover } from "@/lib/attendance/data/cover";
import { getRegister } from "@/lib/attendance/data/register";
import { getClassProgress } from "@/lib/progression/data/progress";
import { claimState } from "@/lib/attendance/claim-state";
import { isIsoDate, mostRecentOccurrence } from "@/lib/attendance/dates";
import { parseDateOnly, today, weekdayOf } from "@/lib/format";

/** No roster, attendance or competency data is read before the teacher's
 * confirmed claim has been checked. This also guards direct/bookmarked URLs. */
export async function getInstructorClass(id: string, requestedDate: unknown) {
  const session = await classPage("instructor");
  const [course, { club }] = await Promise.all([
    getCourse(id),
    getCurrentClub(),
  ]);
  if (!course) return null;
  const requested = isIsoDate(requestedDate) ? requestedDate : null;
  const iso =
    requested &&
    requested <= today() &&
    weekdayOf(parseDateOnly(requested)) === course.dayOfWeek
      ? requested
      : mostRecentOccurrence(course.dayOfWeek);
  const base = { course, session, iso };
  if (course.clubId !== club.id)
    return { ...base, state: "wrong-site" as const };
  if (course.archivedAt) return { ...base, state: "archived" as const };
  const claim = await getClassCover(id, iso);
  const state = claimState(claim, session.user.id);
  if (state !== "mine") return { ...base, state, claim };
  const [register, progress] = await Promise.all([
    getRegister(id, iso),
    getClassProgress(id),
  ]);
  if (!progress) return null;
  return { ...base, state: "ready" as const, claim, register, progress };
}
