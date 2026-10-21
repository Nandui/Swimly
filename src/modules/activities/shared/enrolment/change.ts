import type { ChangePlace } from "@/lib/action-result";
import type { DayOfWeek } from "@/generated/prisma/client";
import { classTimes, DAY_META } from "@/modules/activities/shared/courses/constants";

/** A class as the move and enrolment confirmation shows it: its name, "Monday 16:30 to 17:00",
 *  its level and the centre it runs at. */
export function changePlace(course: {
  name: string | null; dayOfWeek: DayOfWeek; startMinutes: number; durationMinutes: number; level: { name: string };
}, centre: string): ChangePlace {
  return {
    title: course.name ?? course.level.name,
    when: `${DAY_META[course.dayOfWeek].label} ${classTimes(course)}`,
    level: course.level.name,
    centre,
  };
}

/** The sentence the confirmation adds when the level changes. */
export function levelNote(from: string | undefined, to: string): string[] {
  return from && from !== to ? [`Their level changes from ${from} to ${to}.`] : [];
}
