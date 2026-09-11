import { DAY_META, placesLeft } from "@/lib/courses/constants";
import type { ReceptionClassOption } from "./data";

export type ClassFilters = {
  site: string;
  level: string;
  day: string;
  from: string;
  until: string;
  availableOnly: boolean;
};

export function emptyClassFilters(level = "any", site = "any"): ClassFilters {
  return { site, level, day: "any", from: "any", until: "any", availableOnly: true };
}

export function invalidTimeRange(filters: ClassFilters) {
  return filters.from !== "any" && filters.until !== "any" && Number(filters.from) > Number(filters.until);
}

/** Day enums are not alphabetical weekdays. Bounds apply inclusively to the
 *  start time. Null capacity means unlimited, and open waitlist places also
 *  exclude duplicate booking targets. */
export function findReceptionClasses(courses: ReceptionClassOption[], filters: ClassFilters, occupiedIds: string[]) {
  if (invalidTimeRange(filters)) return [];
  const occupied = new Set(occupiedIds);
  return courses.filter(course => !occupied.has(course.id)
    && (filters.site === "any" || course.clubId === filters.site)
    && (filters.level === "any" || course.level.id === filters.level)
    && (filters.day === "any" || course.dayOfWeek === filters.day)
    && (filters.from === "any" || course.startMinutes >= Number(filters.from))
    && (filters.until === "any" || course.startMinutes <= Number(filters.until))
    && (!filters.availableOnly || placesLeft(course._count.enrolments, course.capacity) !== 0))
    .sort((a, b) => DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index
      || a.startMinutes - b.startMinutes
      || a.level.programme.sortOrder - b.level.programme.sortOrder
      || a.level.sortOrder - b.level.sortOrder
      || a.id.localeCompare(b.id));
}
