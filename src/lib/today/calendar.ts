import type { CourseRow } from "@/lib/courses/data/courses";
import type { StatusMeta } from "@/lib/status";

export type CalendarClass = Pick<CourseRow,
  "id" | "name" | "startMinutes" | "durationMinutes" | "capacity" | "location" | "level" | "instructor" | "instructorId"
> & {
  enrolled: number;
  attendanceTaken: boolean;
  cover: { coverById: string | null; coverByName: string; instructorName: string | null } | null;
};

export const CALENDAR_PHASE_META = {
  running: { label: "Running now", color: "green" },
  next: { label: "Next start", color: "blue" },
  finished: { label: "Finished", color: "gray" },
  later: { label: "Later", color: "gray" },
} as const satisfies Record<string, StatusMeta>;

export function classPhase(course: Pick<CalendarClass, "startMinutes" | "durationMinutes">, now: number) {
  if (now >= course.startMinutes + course.durationMinutes) return "finished";
  return now >= course.startMinutes ? "running" : "later";
}

export function filterCalendarClasses(courses: CalendarClass[], location: string, instructor: string, me: string) {
  return courses.filter(course => {
    if (location !== "all" && (course.location ?? "") !== location) return false;
    if (instructor === "all") return true;
    const id = instructor === "mine" ? me : instructor;
    return course.instructorId === id || course.cover?.coverById === id;
  });
}

/** A column is an exact start time, never a rounded bucket. Every class appears
 * once; explicit end times keep longer and overlapping classes unambiguous. */
export function calendarSlots(courses: CalendarClass[], now: number) {
  const sorted = [...courses].sort((a, b) =>
    a.startMinutes - b.startMinutes ||
    a.level.programme.sortOrder - b.level.programme.sortOrder ||
    a.level.programme.name.localeCompare(b.level.programme.name) ||
    a.level.sortOrder - b.level.sortOrder ||
    (a.location ?? "").localeCompare(b.location ?? "", "en", { numeric: true }) ||
    a.id.localeCompare(b.id));
  const groups = new Map<number, CalendarClass[]>();
  for (const course of sorted) {
    const group = groups.get(course.startMinutes) ?? [];
    group.push(course);
    groups.set(course.startMinutes, group);
  }
  const nextStart = sorted.find(course => course.startMinutes > now)?.startMinutes;
  return [...groups].map(([start, classes]) => ({
    start, classes,
    phase: classes.some(course => classPhase(course, now) === "running") ? "running" as const
      : start === nextStart ? "next" as const
        : classes.every(course => classPhase(course, now) === "finished") ? "finished" as const : "later" as const,
  }));
}

export function calendarClassHref(id: string, iso: string, access: { attendance: boolean; courses: boolean }) {
  if (access.attendance) return `/courses/${id}/class?date=${iso}&from=today`;
  return access.courses ? `/courses/${id}` : undefined;
}
