import type { DayOfWeek } from "@/generated/prisma/client";
import { DAY_META, DAYS_IN_ORDER, courseName, formatTime } from "@/lib/courses/constants";
import type { CourseRow } from "@/lib/courses/data/courses";

/** Filtering the timetable, as pure functions over rows already in memory.
 *
 *  Deliberately not a query. The whole timetable is a few hundred rows and the
 *  page reads all of them anyway, so filtering here costs nothing and buys the
 *  thing a `WHERE` clause cannot: **every option can carry an honest count**.
 *  A count is only useful if it accounts for the filters already applied —
 *  "Dolphins 25" is a lie once the day is set to Monday, where there are 3 —
 *  and getting that from the database means one query per dimension per
 *  request. Here it is one pass over an array.
 *
 *  If the timetable ever reaches thousands of classes this is the thing to
 *  revisit, and the seam is `getCourses` returning less. */

export type CourseFilters = {
  q: string;
  programme: string;
  level: string;
  day: string;
  time: string;
  /** A user id, or "none" for the classes nobody is assigned to. */
  instructor: string;
  /** "open" — a place left. "full" — none. */
  places: string;
};

export const EMPTY_FILTERS: CourseFilters = {
  q: "",
  programme: "",
  level: "",
  day: "",
  time: "",
  instructor: "",
  places: "",
};

/** Every key except `q`, which is a text box rather than a picker. */
export const PICKER_KEYS = ["programme", "level", "day", "time", "instructor", "places"] as const;
export type PickerKey = (typeof PICKER_KEYS)[number];

export const PICKER_LABELS: Record<PickerKey, string> = {
  programme: "Programme",
  level: "Level",
  day: "Day",
  time: "Time",
  instructor: "Instructor",
  places: "Places",
};

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

/** The value of `day` that means "the whole week".
 *
 *  A URL with no `day` at all means today — 134 classes is not a page anybody
 *  reads top to bottom, and a timetable opened on the deck is opened for today.
 *  But then clearing the Day chip cannot simply delete the key, or it would
 *  snap straight back to today and the week would be unreachable. So the week
 *  has to be a value, and this is it. Absent means today; `any` means all. */
export const ANY_DAY = "any";

export function parseCourseFilters(params: RawParams, today: DayOfWeek): CourseFilters {
  const day = params.day === undefined ? today : one(params, "day");
  return {
    q: one(params, "q"),
    programme: one(params, "programme"),
    level: one(params, "level"),
    day: day === ANY_DAY ? "" : day,
    time: one(params, "time"),
    instructor: one(params, "instructor"),
    places: one(params, "places"),
  };
}

export function activeFilterCount(filters: CourseFilters): number {
  return Object.values(filters).filter(Boolean).length;
}

function hasPlace(course: CourseRow): boolean {
  return course.capacity === null || course._count.enrolments < course.capacity;
}

/** The searchable text of a class: everything a person might type looking for
 *  it, so "learner" finds the pool and "starfish" finds the level. */
function haystack(course: CourseRow): string {
  return [
    courseName(course),
    course.level.name,
    course.level.programme.name,
    course.location ?? "",
    course.instructor?.name ?? "",
    formatTime(course.startMinutes),
    DAY_META[course.dayOfWeek].label,
  ]
    .join(" ")
    .toLowerCase();
}

/** `except` leaves one dimension out, which is what makes the counts on that
 *  dimension's own options mean anything: they answer "how many if I picked
 *  this instead", not "how many are already showing". */
export function matchesFilters(
  course: CourseRow,
  filters: CourseFilters,
  except?: PickerKey | "q"
): boolean {
  if (except !== "q" && filters.q && !haystack(course).includes(filters.q.toLowerCase())) {
    return false;
  }
  if (except !== "programme" && filters.programme && course.level.programme.id !== filters.programme) {
    return false;
  }
  if (except !== "level" && filters.level && course.levelId !== filters.level) return false;
  if (except !== "day" && filters.day && course.dayOfWeek !== filters.day) return false;
  if (except !== "time" && filters.time && String(course.startMinutes) !== filters.time) return false;
  if (except !== "instructor" && filters.instructor) {
    const matches =
      filters.instructor === "none"
        ? course.instructor === null
        : course.instructorId === filters.instructor;
    if (!matches) return false;
  }
  if (except !== "places" && filters.places) {
    const open = hasPlace(course);
    if (filters.places === "open" && !open) return false;
    if (filters.places === "full" && open) return false;
  }
  return true;
}

export function filterCourses(courses: CourseRow[], filters: CourseFilters): CourseRow[] {
  return courses.filter((course) => matchesFilters(course, filters));
}

export type FilterOption = { value: string; label: string; count: number };

export type FilterDimension = {
  key: PickerKey;
  label: string;
  selected: string;
  selectedLabel: string | null;
  options: FilterOption[];
};

/** One option per distinct value a dimension actually takes, in the order that
 *  reads naturally — the week in week order, times up the clock, everything
 *  else alphabetical. Values nothing has are simply absent: an empty option is
 *  a dead end dressed up as a choice.
 *
 *  A selected value survives even at zero, or picking it would make the way
 *  back out of it disappear. */
function dimension(
  courses: CourseRow[],
  filters: CourseFilters,
  key: PickerKey,
  of: (course: CourseRow) => { value: string; label: string } | null,
  sort: (a: FilterOption, b: FilterOption) => number
): FilterDimension {
  const counts = new Map<string, FilterOption>();

  for (const course of courses) {
    const entry = of(course);
    if (!entry) continue;
    const existing = counts.get(entry.value);
    const hit = matchesFilters(course, filters, key) ? 1 : 0;
    if (existing) existing.count += hit;
    else counts.set(entry.value, { ...entry, count: hit });
  }

  const options = [...counts.values()].filter((o) => o.count > 0 || o.value === filters[key]);
  options.sort(sort);

  return {
    key,
    label: PICKER_LABELS[key],
    selected: filters[key],
    selectedLabel: counts.get(filters[key])?.label ?? null,
    options,
  };
}

const byLabel = (a: FilterOption, b: FilterOption) => a.label.localeCompare(b.label);
const byValueNumber = (a: FilterOption, b: FilterOption) => Number(a.value) - Number(b.value);

export function courseFilterDimensions(
  courses: CourseRow[],
  filters: CourseFilters
): FilterDimension[] {
  const dayOrder = new Map(DAYS_IN_ORDER.map((d, i) => [d as string, i]));

  return [
    dimension(courses, filters, "programme", (c) => ({
      value: c.level.programme.id,
      label: c.level.programme.name,
    }), byLabel),

    dimension(courses, filters, "level", (c) => ({ value: c.levelId, label: c.level.name }), byLabel),

    dimension(
      courses,
      filters,
      "day",
      (c) => ({ value: c.dayOfWeek, label: DAY_META[c.dayOfWeek as DayOfWeek].label }),
      (a, b) => (dayOrder.get(a.value) ?? 99) - (dayOrder.get(b.value) ?? 99)
    ),

    dimension(
      courses,
      filters,
      "time",
      (c) => ({ value: String(c.startMinutes), label: formatTime(c.startMinutes) }),
      byValueNumber
    ),

    dimension(
      courses,
      filters,
      "instructor",
      (c) => ({ value: c.instructorId ?? "none", label: c.instructor?.name ?? "Nobody assigned" }),
      byLabel
    ),

    dimension(
      courses,
      filters,
      "places",
      (c) => (hasPlace(c) ? { value: "open", label: "Has a place" } : { value: "full", label: "Full" }),
      byLabel
    ),
  ];
}
