import type { DayOfWeek } from "@/generated/prisma/client";
import { addDaysIso, isDateOnly, parseDateOnly, toDateOnlyString, weekdayOf } from "@/lib/format";

/** How far ahead the last-lesson picker reaches: about half a year of a
 *  weekly class. */
export const LAST_LESSON_WEEKS = 26;

/** A scheduled unenrolment is stored as the first day the swimmer is no
 *  longer in the class (`scheduledEndOn`), so every list that asks "is this
 *  place live on this day?" keeps them for their last lesson. Staff choose the
 *  last lesson; the place ends the day after it. */
export function endAfterLesson(lastLesson: string): string {
  return addDaysIso(lastLesson, 1);
}

/** The class's lessons from today (today included, even once it has run)
 *  that the place is still live for, as `YYYY-MM-DD`. A cancelled lesson
 *  stays listed: keeping the place through it is what entitles the swimmer
 *  to its credit. */
export function upcomingLessons(dayOfWeek: DayOfWeek, startedOn: Date, fromIso: string, weeks = LAST_LESSON_WEEKS): string[] {
  let first = fromIso;
  while (weekdayOf(parseDateOnly(first)) !== dayOfWeek) first = addDaysIso(first, 1);
  const lessons: string[] = [];
  for (let week = 0; week < weeks; week++) {
    const iso = addDaysIso(first, week * 7);
    if (parseDateOnly(iso) >= startedOn) lessons.push(iso);
  }
  return lessons;
}

/** The last lesson the place covers when it ends on `scheduledEndOn`: the
 *  class's weekday before that date. Exact for schedules saved by lesson, and
 *  the honest reading of one saved with a bare date before 1.9.1. */
export function lastLessonBefore(dayOfWeek: DayOfWeek, scheduledEndOn: Date): string {
  let iso = addDaysIso(toDateOnlyString(scheduledEndOn), -1);
  while (weekdayOf(parseDateOnly(iso)) !== dayOfWeek) iso = addDaysIso(iso, -1);
  return iso;
}

/** Why a chosen last lesson can't be saved, or null when it can. */
export function lastLessonError(value: unknown, course: { dayOfWeek: DayOfWeek }, startedOn: Date, todayIso: string): string | null {
  if (!isDateOnly(value)) return "Choose their last lesson.";
  if (weekdayOf(parseDateOnly(value)) !== course.dayOfWeek) return "Choose one of this class's lessons.";
  if (value < todayIso) return "Choose a lesson from today on, or use Unenrol now.";
  if (parseDateOnly(value) < startedOn) return "Choose a lesson after the place starts.";
  return null;
}

