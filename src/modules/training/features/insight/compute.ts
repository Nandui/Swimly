/** The sums behind Training insight (e-learning phase 7): how far people get through a course,
 *  where they stop, how long they take and how the exam goes. Pure, so it is tested without a
 *  database; the server reads build the rows. Cancelled training never counts. */

export type Attempt = { number: number; percent: number | null; passed: boolean | null; submittedAt: Date | null };
export type LearnerFacts = {
  userId: string;
  status: string;
  assignedAt: Date;
  dueOn: Date | null;
  completedAt: Date | null;
  lessons: { lessonId: string; at: Date }[];
  attempts: Attempt[];
};

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

/** The middle value, or null for none. Halves are rounded to one decimal. */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 10) / 10;
}

export const percentOf = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null);

/** Whole days from one moment to another, never below zero. */
export const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY));

const submitted = (a: LearnerFacts) => a.attempts.filter((t) => t.submittedAt);
export const started = (a: LearnerFacts) => a.lessons.length > 0 || submitted(a).length > 0 || a.status === "SUBMITTED" || a.status === "COMPLETED";
const passedExam = (a: LearnerFacts) => submitted(a).some((t) => t.passed);
export const isOverdue = (a: LearnerFacts, on: string) => a.status === "ASSIGNED" && !!a.dueOn && isoDay(a.dueOn) < on;
export function lastActivity(a: LearnerFacts): Date | null {
  const times = [...a.lessons.map((l) => l.at.getTime()), ...submitted(a).map((t) => t.submittedAt!.getTime()), a.completedAt?.getTime() ?? 0].filter(Boolean);
  return times.length ? new Date(Math.max(...times)) : null;
}
export function bestScore(a: LearnerFacts): number | null {
  const scores = submitted(a).map((t) => t.percent).filter((p): p is number => p !== null);
  return scores.length ? Math.max(...scores) : null;
}

/** How far people get, step by step. `lessonIds` is the course's lessons in order; "finished the
 *  lessons" means every one of them, or the exam passed by testing out. Steps that the course
 *  does not have (no exam, no sign-off) are left out by the caller. */
export function funnel(rows: LearnerFacts[], lessonIds: string[]) {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const every = new Set(lessonIds);
  const finishedLessons = (r: LearnerFacts) => r.status === "COMPLETED" || passedExam(r) || (every.size > 0 && [...every].every((id) => r.lessons.some((l) => l.lessonId === id)));
  return {
    assigned: live.length,
    started: live.filter(started).length,
    lessonsDone: live.filter(finishedLessons).length,
    examPassed: live.filter(passedExam).length,
    awaitingSignoff: live.filter((r) => r.status === "SUBMITTED").length,
    completed: live.filter((r) => r.status === "COMPLETED").length,
  };
}

/** Where people stop: for each lesson in order, how many have finished it, and how many of the
 *  people still taking the course have it as their next lesson (they stopped there). People who
 *  have not opened the course yet are counted on their own. */
export function dropOff(rows: LearnerFacts[], lessonIds: string[]) {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const done = new Map(live.map((r) => [r, new Set(r.lessons.map((l) => l.lessonId))]));
  const open = live.filter((r) => r.status === "ASSIGNED" && !passedExam(r));
  const stoppedAt = new Map<string, number>();
  let notStarted = 0;
  for (const r of open) {
    const has = done.get(r)!;
    if (!started(r)) { notStarted += 1; continue; }
    const next = lessonIds.find((id) => !has.has(id));
    if (next) stoppedAt.set(next, (stoppedAt.get(next) ?? 0) + 1);
  }
  const lessons = lessonIds.map((id) => ({ lessonId: id, reached: live.filter((r) => done.get(r)!.has(id)).length, stoppedHere: stoppedAt.get(id) ?? 0 }));
  const most = lessons.reduce<(typeof lessons)[number] | null>((top, l) => (l.stoppedHere > (top?.stoppedHere ?? 0) ? l : top), null);
  return { lessons, notStarted, inProgress: open.length - notStarted, mostStopped: most?.lessonId ?? null };
}

/** How long people take: whole days from being given it to completing it, and from their first
 *  lesson to completing it (the time they actually spent on it). Medians, as a few people who
 *  leave a course for months would pull an average far off. Also how many finish by their due date. */
export function timing(rows: LearnerFacts[]) {
  const done = rows.filter((r) => r.status === "COMPLETED" && r.completedAt);
  const firstLesson = (r: LearnerFacts) => r.lessons.reduce<Date | null>((min, l) => (!min || l.at < min ? l.at : min), null);
  const dated = done.filter((r) => r.dueOn);
  return {
    daysToFinish: median(done.map((r) => daysBetween(r.assignedAt, r.completedAt!))),
    daysLearning: median(done.map((r) => { const first = firstLesson(r); return first ? daysBetween(first, r.completedAt!) : null; }).filter((d): d is number => d !== null)),
    onTime: percentOf(dated.filter((r) => isoDay(r.completedAt!) <= isoDay(r.dueOn!)).length, dated.length),
    dated: dated.length,
  };
}

/** How the final exam goes: passed first time (of those who sat it at least once), passed at all,
 *  the middle best score and how many tries a pass takes on average. */
export function examStats(rows: LearnerFacts[]) {
  const sat = rows.filter((r) => r.status !== "CANCELLED" && submitted(r).length > 0);
  const first = sat.filter((r) => submitted(r).some((t) => t.number === 1 && t.passed));
  const passers = sat.filter(passedExam);
  const triesToPass = passers.map((r) => submitted(r).filter((t) => t.passed).reduce((min, t) => Math.min(min, t.number), Infinity));
  return {
    sat: sat.length,
    firstTime: percentOf(first.length, sat.length),
    passed: percentOf(passers.length, sat.length),
    medianBest: median(sat.map(bestScore).filter((s): s is number => s !== null)),
    triesToPass: triesToPass.length ? Math.round((triesToPass.reduce((n, t) => n + t, 0) / triesToPass.length) * 10) / 10 : null,
  };
}

/** One line per group (a site, a manager): how many have it, how many finished, how many are
 *  overdue, first-time passes and the middle days to finish. */
export function summaryOf(rows: LearnerFacts[], on: string) {
  const live = rows.filter((r) => r.status !== "CANCELLED");
  const completed = live.filter((r) => r.status === "COMPLETED").length;
  const exam = examStats(live);
  return {
    assigned: live.length, completed, completion: percentOf(completed, live.length),
    overdue: live.filter((r) => isOverdue(r, on)).length,
    firstTime: exam.firstTime, daysToFinish: timing(live).daysToFinish,
  };
}

/** Groups rows by a key that can give several (a person at two sites counts at both). */
export function groupBy<T>(rows: T[], keys: (row: T) => string[]) {
  const by = new Map<string, T[]>();
  for (const row of rows) for (const key of keys(row)) by.set(key, [...(by.get(key) ?? []), row]);
  return by;
}

/** A learner's progress in words for a table and the download. */
export function stageOf(r: LearnerFacts, lessonCount: number, on: string): string {
  switch (r.status) {
    case "COMPLETED": return "Completed";
    case "SUBMITTED": return "Awaiting sign-off";
    case "CANCELLED": return "Cancelled";
  }
  const lessons = new Set(r.lessons.map((l) => l.lessonId)).size;
  const where = passedExam(r) ? "Exam passed" : !started(r) ? "Not started" : lessonCount ? `${Math.min(lessons, lessonCount)} of ${lessonCount} lessons` : "Started";
  return isOverdue(r, on) ? `${where}, overdue` : where;
}
