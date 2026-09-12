import type { CourseRow } from "@/lib/courses/data/courses";
import type { StatusMeta } from "@/lib/status";

export type CalendarClass = Pick<CourseRow,
  "id" | "name" | "startMinutes" | "durationMinutes" | "capacity" | "location" | "level" | "instructor" | "instructorId"
> & {
  enrolled: number;
  attendanceTaken: boolean;
  cover: { coverById: string | null; coverByName: string; instructorId?: string | null; instructorName: string | null } | null;
};

export type CalendarAssessment = {
  id: string; startMinutes: number; durationMinutes: number; capacity: number | null;
  location: string | null; booked: number; programmeName: string; typeName: string | null;
  instructorId: string | null; instructor: { id: string; name: string } | null;
};

type AgendaEntry = { kind: "class"; value: CalendarClass } | { kind: "assessment"; value: CalendarAssessment };

export function filterCalendarAssessments(sessions: CalendarAssessment[], location: string, instructor: string, me: string) {
  return sessions.filter(session => (location === "all" || (session.location ?? "") === location)
    && (instructor === "all" || session.instructorId === (instructor === "mine" ? me : instructor)));
}

/** A mixed agenda retains parallel classes and assessments, even with matching IDs. */
export function calendarAgendaSlots(courses: CalendarClass[], assessments: CalendarAssessment[], now: number) {
  const entries: AgendaEntry[] = [
    ...calendarSlots(courses, now).flatMap(slot => slot.classes.map(value => ({ kind: "class" as const, value }))),
    ...assessments.map(value => ({ kind: "assessment" as const, value })),
  ];
  entries.sort((a, b) => a.value.startMinutes - b.value.startMinutes || a.kind.localeCompare(b.kind));
  const groups = new Map<number, AgendaEntry[]>();
  for (const entry of entries) {
    const start = entry.value.startMinutes;
    const group = groups.get(start) ?? [];
    group.push(entry); groups.set(start, group);
  }
  const next = entries.find(entry => entry.value.startMinutes > now)?.value.startMinutes;
  return [...groups].map(([start, entries]) => ({ start, entries,
    phase: entries.some(entry => classPhase(entry.value, now) === "running") ? "running" as const
      : start === next ? "next" as const
        : entries.every(entry => classPhase(entry.value, now) === "finished") ? "finished" as const : "later" as const,
  }));
}

export function calendarAssessmentHref(id: string, allowed: boolean) {
  return allowed ? `/assessments/${encodeURIComponent(id)}` : undefined;
}

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

/** Keep the curriculum as rows, including every class sharing a level/start.
 * IDs, rather than display names, distinguish levels in different programmes. */
export function calendarProgrammes(courses: CalendarClass[]) {
  type LevelRow = { level: CalendarClass["level"]; starts: Map<number, CalendarClass[]> };
  const programmes = new Map<string, {
    programme: CalendarClass["level"]["programme"]; levels: Map<string, LevelRow>;
  }>();
  for (const course of courses) {
    const { level } = course;
    let group = programmes.get(level.programme.id);
    if (!group) {
      group = { programme: level.programme, levels: new Map() };
      programmes.set(level.programme.id, group);
    }
    let row = group.levels.get(level.id);
    if (!row) {
      row = { level, starts: new Map() };
      group.levels.set(level.id, row);
    }
    const classes = row.starts.get(course.startMinutes) ?? [];
    classes.push(course);
    row.starts.set(course.startMinutes, classes);
  }
  const curriculumOrder = (a: { sortOrder: number; name: string; id: string }, b: { sortOrder: number; name: string; id: string }) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  return [...programmes.values()]
    .sort((a, b) => curriculumOrder(a.programme, b.programme))
    .map(({ programme, levels }) => ({
      programme,
      levels: [...levels.values()].sort((a, b) => curriculumOrder(a.level, b.level)).map(row => {
        for (const classes of row.starts.values()) {
          classes.sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "", "en", { numeric: true }) || a.id.localeCompare(b.id));
        }
        return row;
      }),
    }));
}

export function calendarClassHref(id: string, iso: string, access: { attendance: boolean; courses: boolean }) {
  if (access.attendance) return `/courses/${id}/class?date=${iso}&from=today`;
  return access.courses ? `/courses/${id}` : undefined;
}
