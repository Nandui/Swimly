import { DAY_META, courseName, formatTimeRange, placesLeft } from "@/lib/courses/constants";
import type { TransferTarget } from "./data/enrolments";

export type ClassPickerFilters = {
  site: string;
  level: string;
  day: string;
  time: string;
  search: string;
  availableOnly: boolean;
};

export const ALL_CLASSES: ClassPickerFilters = {
  site: "all", level: "all", day: "all", time: "all", search: "", availableOnly: true,
};

/** The picker filters the shared timetable; a site never limits swimmer access. */
export function filterClassChoices(courses: TransferTarget[], filters: ClassPickerFilters) {
  const words = filters.search.trim().toLocaleLowerCase("en").split(/\s+/).filter(Boolean);
  return courses.filter(course => {
    if (filters.site !== "all" && course.club.id !== filters.site) return false;
    if (filters.level !== "all" && course.level.id !== filters.level) return false;
    if (filters.day !== "all" && course.dayOfWeek !== filters.day) return false;
    if (filters.time !== "all" && String(course.startMinutes) !== filters.time) return false;
    if (filters.availableOnly && placesLeft(course._count.enrolments, course.capacity) === 0) return false;
    const text = [courseName(course), course.level.name, course.club.name, DAY_META[course.dayOfWeek].label,
      formatTimeRange(course), course.location, course.instructor?.name].join(" ").toLocaleLowerCase("en");
    return words.every(word => text.includes(word));
  }).sort((a, b) => DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index ||
    a.startMinutes - b.startMinutes || a.club.name.localeCompare(b.club.name) ||
    courseName(a).localeCompare(courseName(b)) || a.id.localeCompare(b.id));
}
