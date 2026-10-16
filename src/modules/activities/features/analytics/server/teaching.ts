import type { CompletionRow, LessonRow, StudentTeacherRow, TickRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { teacherKey, within, type LeaveEvent } from "@/modules/activities/features/analytics/server/swimmers";

/** A lesson started more than this many minutes after its start time counts as late. */
export const ON_TIME_MINUTES = 5;

export type Lesson = LessonRow & {
  /** Finished by `now`: only finished lessons count towards registers and attendance. */
  finished: boolean;
  /** Who taught it: the person who started it, or (not started) who was planned. */
  teacher: { key: string; name: string } | null;
  planned: { key: string; name: string } | null;
  cover: boolean; registerComplete: boolean | null; onTime: boolean | null;
};

export function readLessons(rows: LessonRow[], today: string, minutes: number): Lesson[] {
  return rows.map(row => {
    const finished = row.date < today || (row.date === today && row.startMinutes + row.durationMinutes <= minutes);
    const planned = row.plannedName ? { key: teacherKey(row.plannedId, row.plannedName), name: row.plannedName } : null;
    const teacher = row.started && row.teacherName ? { key: teacherKey(row.teacherId, row.teacherName), name: row.teacherName } : planned;
    return {
      ...row, finished, teacher, planned,
      cover: row.started && planned !== null && teacher !== null && planned.key !== teacher.key,
      registerComplete: finished && !row.cancelled && row.expected > 0 ? row.marked >= row.expected : null,
      onTime: row.started && row.startOffset !== null ? row.startOffset <= ON_TIME_MINUTES : null,
    };
  });
}

/** Lessons that went ahead and finished (not cancelled) in a date range. */
export function heldLessons(lessons: Lesson[], from: string, to: string) {
  return lessons.filter(l => l.finished && !l.cancelled && within(l.date, from, to));
}

export function attendanceRate(lessons: Lesson[]) {
  const marked = lessons.reduce((s, l) => s + l.marked, 0);
  const came = lessons.reduce((s, l) => s + l.present + l.late, 0);
  return marked ? came / marked * 100 : null;
}

export function registerRate(lessons: Lesson[]) {
  const due = lessons.filter(l => l.registerComplete !== null);
  return due.length ? due.filter(l => l.registerComplete).length / due.length * 100 : null;
}

export type TeacherStats = ReturnType<typeof teacherStats>[number];

/** Everyone who taught or was planned to teach at these sites in the period,
 *  from the lessons themselves: what they taught, how their lessons went and
 *  what happened to the swimmers in front of them. */
export function teacherStats(args: {
  lessons: Lesson[]; from: string; to: string;
  studentTeachers: StudentTeacherRow[]; ticks: TickRow[]; completions: CompletionRow[];
  leaves: LeaveEvent[]; lastTeacherOf: Map<string, { key: string; name: string } | null>;
}) {
  const { from, to } = args;
  const held = heldLessons(args.lessons, from, to);
  const people = new Map<string, { key: string; name: string; id: string | null }>();
  const person = (key: string, name: string) => {
    const row = people.get(key) ?? { key, name, id: key.startsWith("staff:") ? key.slice(6) : null };
    people.set(key, row);
    return row;
  };
  for (const l of held) if (l.teacher) person(l.teacher.key, l.teacher.name);

  const swimmers = new Map<string, Set<string>>();
  for (const row of args.studentTeachers) {
    if (!row.inPeriod) continue;
    const key = teacherKey(row.teacherId, row.teacherName);
    person(key, row.teacherName);
    swimmers.set(key, (swimmers.get(key) ?? new Set()).add(row.studentId));
  }
  const ticks = new Map<string, number>();
  for (const t of args.ticks) if (within(t.assessedOn, from, to)) {
    const key = teacherKey(t.assessedById, t.assessedByName);
    if (!people.has(key)) continue;
    ticks.set(key, (ticks.get(key) ?? 0) + 1);
  }
  const passes = new Map<string, number>();
  for (const c of args.completions) if (within(c.completedOn, from, to)) {
    const key = teacherKey(c.confirmedById, c.confirmedByName);
    if (!people.has(key)) continue;
    passes.set(key, (passes.get(key) ?? 0) + 1);
  }
  const leavers = new Map<string, LeaveEvent[]>();
  for (const e of args.leaves) if (within(e.date, from, to)) {
    const teacher = args.lastTeacherOf.get(e.studentId);
    if (teacher && people.has(teacher.key)) leavers.set(teacher.key, [...leavers.get(teacher.key) ?? [], e]);
  }

  return [...people.values()].map(p => {
    const taught = held.filter(l => l.started && l.teacher?.key === p.key);
    const missedStarts = held.filter(l => !l.started && l.planned?.key === p.key && l.expected > 0).length;
    const started = taught.filter(l => l.onTime !== null);
    const lateStarts = started.filter(l => l.onTime === false);
    const taughtSwimmers = swimmers.get(p.key)?.size ?? 0;
    const left = leavers.get(p.key) ?? [];
    return {
      ...p,
      lessons: taught.length,
      hours: taught.reduce((s, l) => s + l.durationMinutes, 0) / 60,
      classes: new Set(taught.map(l => l.courseId)).size,
      cover: taught.filter(l => l.cover).length,
      missedStarts,
      swimmers: taughtSwimmers,
      attendance: attendanceRate(taught),
      registers: registerRate(taught),
      onTime: started.length ? (started.length - lateStarts.length) / started.length * 100 : null,
      averageLate: lateStarts.length ? lateStarts.reduce((s, l) => s + (l.startOffset ?? 0), 0) / lateStarts.length : null,
      ticks: ticks.get(p.key) ?? 0,
      ticksPerLesson: taught.length ? (ticks.get(p.key) ?? 0) / taught.length : null,
      passes: passes.get(p.key) ?? 0,
      passRate: taughtSwimmers ? (passes.get(p.key) ?? 0) / taughtSwimmers * 100 : null,
      leavers: left.length,
      leaverRate: taughtSwimmers ? left.length / taughtSwimmers * 100 : null,
      leaverReasons: countBy(left.map(e => e.reason ?? "none")),
    };
  }).filter(p => p.lessons > 0 || p.missedStarts > 0)
    .sort((a, b) => b.lessons - a.lessons || a.name.localeCompare(b.name));
}

export function countBy(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** The whole school's figures on the same rules, for comparing one teacher. */
export function schoolAverages(teachers: TeacherStats[], lessons: Lesson[]) {
  const taught = lessons.filter(l => l.started);
  const started = taught.filter(l => l.onTime !== null);
  const swimmers = teachers.reduce((s, t) => s + t.swimmers, 0);
  return {
    attendance: attendanceRate(taught),
    registers: registerRate(taught),
    onTime: started.length ? started.filter(l => l.onTime).length / started.length * 100 : null,
    ticksPerLesson: taught.length ? teachers.reduce((s, t) => s + t.ticks, 0) / taught.length : null,
    passRate: swimmers ? teachers.reduce((s, t) => s + t.passes, 0) / swimmers * 100 : null,
    leaverRate: swimmers ? teachers.reduce((s, t) => s + t.leavers, 0) / swimmers * 100 : null,
  };
}
