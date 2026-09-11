import type { CourseRow } from "./data/courses";
import { DAY_META } from "./constants";
import { filterCourses, parseCourseFilters, type CourseFilters } from "./filters";

type Params = Record<string, string | string[] | undefined>;
const QUERY_KEYS = ["q", "programme", "level", "day", "time", "instructor", "location", "places", "state", "page"] as const;
export const CLASS_PAGE_SIZE = 24;

/** Only class-browser parameters can travel through a detail page's return link. */
export function classBrowserHref(params: Params, changes: Record<string, string | null> = {}) {
  const values = { ...params, ...changes };
  const query = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) query.set(key, value.trim());
  }
  return `/courses${query.size ? `?${query}` : ""}`;
}

export function classReturnHref(value: string | string[] | undefined) {
  if (typeof value !== "string" || (value !== "/courses" && !value.startsWith("/courses?"))) return "/courses";
  const query = new URLSearchParams(value.split("?").slice(1).join("?"));
  return classBrowserHref(Object.fromEntries(query));
}

export function classDetailsHref(id: string, returnTo: string) {
  return `/courses/${encodeURIComponent(id)}?${new URLSearchParams({ returnTo: classReturnHref(returnTo) })}`;
}

export function classBrowserModel(courses: CourseRow[], params: Params) {
  const filters: CourseFilters = parseCourseFilters(params);
  const state: "archived" | "active" = params.state === "archived" ? "archived" : "active";
  const collection = courses.filter(course => state === "archived" ? !!course.archivedAt : !course.archivedAt);
  const matches = filterCourses(collection, filters).sort((a, b) =>
    DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index || a.startMinutes - b.startMinutes ||
    a.level.programme.sortOrder - b.level.programme.sortOrder || a.level.sortOrder - b.level.sortOrder ||
    a.id.localeCompare(b.id));
  const totalPages = Math.max(1, Math.ceil(matches.length / CLASS_PAGE_SIZE));
  const requested = typeof params.page === "string" && /^\d+$/.test(params.page) ? Number(params.page) : 1;
  const page = Number.isSafeInteger(requested) ? Math.min(totalPages, Math.max(1, requested)) : 1;
  const returnTo = classBrowserHref(params, { page: page > 1 ? String(page) : null });
  return {
    filters, state, collection, matches, page, returnTo,
    rows: matches.slice((page - 1) * CLASS_PAGE_SIZE, page * CLASS_PAGE_SIZE),
    activeCount: courses.filter(course => !course.archivedAt).length,
    archivedCount: courses.filter(course => course.archivedAt).length,
  };
}
