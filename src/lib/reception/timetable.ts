import type { CourseRow } from "@/lib/courses/data/courses";
import { formatTime } from "@/lib/courses/constants";

export type ReceptionGrouping = "time" | "level";
export type ReceptionClass = Pick<CourseRow,
  "id" | "name" | "dayOfWeek" | "startMinutes" | "durationMinutes" | "capacity" |
  "location" | "level" | "instructor" | "_count"
> & { coverName: string | null };

export function groupReceptionClasses(courses: ReceptionClass[], grouping: ReceptionGrouping) {
  const byLevel = (a: ReceptionClass, b: ReceptionClass) =>
    a.level.programme.sortOrder - b.level.programme.sortOrder ||
    a.level.programme.name.localeCompare(b.level.programme.name) ||
    a.level.sortOrder - b.level.sortOrder || a.level.name.localeCompare(b.level.name);
  const byTime = (a: ReceptionClass, b: ReceptionClass) => a.startMinutes - b.startMinutes;
  const ordered = [...courses].sort((a, b) =>
    (grouping === "time" ? byTime(a, b) || byLevel(a, b) : byLevel(a, b) || byTime(a, b)) || a.id.localeCompare(b.id)
  );
  const groups = new Map<string, { key: string; title: string; description?: string; courses: ReceptionClass[] }>();
  for (const course of ordered) {
    const key = grouping === "time" ? String(course.startMinutes) : course.level.id;
    const section = groups.get(key) ?? {
      key, title: grouping === "time" ? formatTime(course.startMinutes) : course.level.name,
      description: grouping === "level" ? course.level.programme.name : undefined,
      courses: [],
    };
    section.courses.push(course);
    groups.set(key, section);
  }
  return [...groups.values()];
}

export function receptionHref(swimmerId?: string | null, group: ReceptionGrouping = "time") {
  const query = new URLSearchParams();
  if (swimmerId) query.set("swimmer", swimmerId);
  if (group !== "time") query.set("group", group);
  return `/reception${query.size ? `?${query}` : ""}`;
}
