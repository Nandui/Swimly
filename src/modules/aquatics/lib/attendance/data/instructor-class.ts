import { classPage } from "@/modules/aquatics/lib/attendance/page-guard";
import { getCourse } from "@/modules/aquatics/lib/courses/data/courses";
import { getCurrentClub } from "@/lib/clubs/current";
import { getClassCover } from "@/modules/aquatics/lib/attendance/data/cover";
import { getRegister } from "@/modules/aquatics/lib/attendance/data/register";
import { getClassProgress } from "@/modules/aquatics/lib/progression/data/progress";
import { claimState } from "@/modules/aquatics/lib/attendance/claim-state";
import { isIsoDate, mostRecentOccurrence } from "@/modules/aquatics/lib/attendance/dates";
import { parseDateOnly, today, weekdayOf } from "@/lib/format";
import { getCancellation } from "@/modules/aquatics/lib/cancellations/data";

/** Require Instructor access and a confirmed start before loading the roster.
 * A colleague's start also opens the class, including existing dated records. */
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
  const cancellation = await getCancellation(id, iso);
  if (cancellation) return { ...base, state: "cancelled" as const, cancellation };
  const claim = await getClassCover(id, iso);
  const state = claimState(claim, session.user.id);
  if (state === "available") return { ...base, state, claim };
  const [register, progress] = await Promise.all([
    getRegister(id, iso, "deck"),
    getClassProgress(id),
  ]);
  if (!progress) return null;
  return { ...base, state: "ready" as const, claim, register, progress };
}
