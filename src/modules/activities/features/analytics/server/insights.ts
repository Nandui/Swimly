import type { DayOfWeek } from "@/generated/prisma/client";
import { addDaysIso } from "@/lib/format";
import { sharedIds, latestSharedMarks } from "@/modules/activities/shared/curriculum/shared";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import { LEAVE_REASONS, isLeaveReason } from "@/modules/activities/shared/enrolment/leave-reasons";
import type {
  AssessmentRow, CompletionRow, CourseRow, MarkRow, PlaceRow, ResultRow, StudentCourseRow, StudentTeacherRow, TickRow, WaitlistRow,
} from "@/modules/activities/features/analytics/server/insight-queries";
import { lastMonths, weeksBetween, type ReportPeriod } from "@/modules/activities/features/analytics/server/period";
import {
  activeAt, ageProfile, attendanceRisk, lastTeacher, monthlyMovement, movements, retention, swimmerSpans, tenureBand, TENURE_BANDS, within,
  type LeaveEvent,
} from "@/modules/activities/features/analytics/server/swimmers";
import { attendanceRate, countBy, heldLessons, registerRate, schoolAverages, teacherStats, type Lesson } from "@/modules/activities/features/analytics/server/teaching";

/** Weeks at one level after which a swimmer is flagged as stuck (industry
 *  guidance: more than 25 weeks at one level needs a closer look). */
const STUCK_WEEKS = 26;

type Definition = { id: string; sharedWithId: string | null; name: string; sortOrder: number; archivedAt: Date | null };
export type Curriculum = {
  programmes: Definition[];
  levels: (Definition & { programmeId: string })[];
  competencies: (Definition & { levelId: string })[];
};

export type Dataset = {
  period: ReportPeriod; minutes: number;
  places: PlaceRow[]; waitlist: WaitlistRow[]; courses: CourseRow[]; lessons: Lesson[];
  studentTeachers: StudentTeacherRow[]; marks: MarkRow[]; studentCourses: StudentCourseRow[];
  completions: CompletionRow[]; ticks: TickRow[]; results: ResultRow[]; assessments: AssessmentRow[];
  curriculum: Curriculum;
};

export type Names = Map<string, { name: string; memberNumber: string | null }>;

const pct = (part: number, whole: number) => whole ? part / whole * 100 : null;

function group<T>(rows: T[], key: (row: T) => string) {
  const out = new Map<string, T[]>();
  for (const row of rows) { const k = key(row); const list = out.get(k); if (list) list.push(row); else out.set(k, [row]); }
  return out;
}

/** Labels for leave reasons, including the two Analytics adds itself. */
function reasonLabel(key: string) {
  if (key === "finished-class") return "Finished their class";
  if (key === "none") return "Not recorded";
  return isLeaveReason(key) ? LEAVE_REASONS[key] : "Not recorded";
}

/** Shared levels and programmes read as one, ordered like the curriculum. */
export function curriculumIndex(curriculum: Curriculum) {
  const levelIds = sharedIds(curriculum.levels), programmeIds = sharedIds(curriculum.programmes), competencyIds = sharedIds(curriculum.competencies);
  const levels = new Map(curriculum.levels.map(l => [l.id, l]));
  const programmes = new Map(curriculum.programmes.map(p => [p.id, p]));
  const level = (id: string) => levels.get(levelIds.resolve(id));
  const programmeOf = (levelId: string) => {
    const l = level(levelId);
    return l ? programmes.get(programmeIds.resolve(l.programmeId)) : undefined;
  };
  const order = (levelId: string) => {
    const l = level(levelId), p = programmeOf(levelId);
    return [p?.sortOrder ?? 0, p?.name ?? "", l?.sortOrder ?? 0, l?.name ?? ""] as const;
  };
  const compare = (a: string, b: string) => {
    const x = order(a), y = order(b);
    return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2] - y[2] || x[3].localeCompare(y[3]);
  };
  const skills = new Map<string, (Definition & { levelId: string })[]>();
  for (const c of curriculum.competencies) {
    if (c.sharedWithId || c.archivedAt) continue;
    const key = levelIds.resolve(c.levelId);
    skills.set(key, [...skills.get(key) ?? [], c].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
  }
  return { resolveLevel: levelIds.resolve, resolveCompetency: competencyIds.resolve, level, programmeOf, compare, skills };
}

function courseName(course: CourseRow) {
  return course.name ?? course.levelName;
}
export function courseSlot(course: Pick<CourseRow, "dayOfWeek" | "startMinutes">) {
  return { dayOfWeek: course.dayOfWeek as DayOfWeek, startMinutes: course.startMinutes };
}

function marksByStudent(marks: MarkRow[]) {
  const out = new Map<string, MarkRow[]>();
  for (const m of marks) out.set(m.studentId, [...out.get(m.studentId) ?? [], m]);
  return out;
}

/** Everything the five pages share: who is here now, who came and went. */
function basics(ds: Dataset) {
  const { period } = ds;
  const spans = swimmerSpans(ds.places);
  const moves = movements(spans, period.today);
  const now = activeAt(ds.places, period.today);
  const marks = marksByStudent(ds.marks);
  const lastTeacherOf = new Map([...marks.entries()].map(([id, rows]) => [id, lastTeacher(rows)]));
  return { spans, moves, now, marks, lastTeacherOf };
}

function liveCourses(ds: Dataset) {
  return ds.courses.filter(c => !c.archived);
}

/** Places and capacity across live classes today; uncapped classes add places, not capacity. */
function fill(ds: Dataset, courseIds?: Set<string>) {
  let enrolled = 0, capacity = 0, cappedEnrolled = 0;
  const live = liveCourses(ds).filter(c => !courseIds || courseIds.has(c.id));
  const counts = placesByCourse(ds);
  for (const c of live) {
    const n = counts.get(c.id) ?? 0;
    enrolled += n;
    if (c.capacity !== null) { capacity += c.capacity; cappedEnrolled += n; }
  }
  return { enrolled, capacity, rate: pct(cappedEnrolled, capacity), empty: Math.max(0, capacity - cappedEnrolled) };
}

function placesByCourse(ds: Dataset) {
  const counts = new Map<string, number>();
  for (const p of ds.places) if (p.inScope && p.startedOn <= ds.period.today && (p.endOn === null || p.endOn > ds.period.today)) counts.set(p.courseId, (counts.get(p.courseId) ?? 0) + 1);
  return counts;
}

function comparison(current: number | null, previous: number | null) {
  return { current, previous, change: current !== null && previous !== null ? current - previous : null };
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function buildOverview(ds: Dataset) {
  const { period } = ds;
  const { moves, now, marks } = basics(ds);
  const index = curriculumIndex(ds.curriculum);
  const inPeriod = <T extends { date: string }>(rows: T[]) => rows.filter(e => within(e.date, period.start, period.end));
  const inPrevious = <T extends { date: string }>(rows: T[]) => rows.filter(e => within(e.date, period.previousStart, period.previousEnd));
  const held = heldLessons(ds.lessons, period.start, period.end), heldBefore = heldLessons(ds.lessons, period.previousStart, period.previousEnd);
  const passes = (from: string, to: string) => ds.completions.filter(c => within(c.completedOn, from, to) && placeAt(ds.places, c.studentId, c.levelId, c.completedOn, index.resolveLevel)?.inScope).length;
  const startCount = activeAt(ds.places, addDaysIso(period.start, -1)).swimmers.size;
  const waitingSwimmers = new Set(ds.waitlist.map(w => w.studentId));
  const filled = fill(ds);
  const trendWeeks = period.weeks.length >= 13 ? period.weeks : Array.from({ length: 13 }, (_, i) => addDaysIso(period.weeks[period.weeks.length - 1], (i - 12) * 7));
  const trend = trendWeeks.map(week => {
    const end = addDaysIso(week, 6) < period.today ? addDaysIso(week, 6) : period.today;
    const count = (events: { date: string }[]) => events.filter(e => within(e.date, week, end)).length;
    return { week, swimmers: activeAt(ds.places, end).swimmers.size, joined: count(moves.joins), left: count(moves.leaves) };
  });

  // Needs attention: the few things worth acting on this week.
  const classes = buildClassRows(ds);
  const atRisk = [...now.swimmers].filter(id => attendanceRisk(marks.get(id) ?? []).reasons.length > 0).length;
  const fullWithWaiting = classes.filter(c => c.waiting > 0 && c.fill !== null && c.fill >= 100).sort((a, b) => b.waiting - a.waiting);
  const quiet = classes.filter(c => c.fill !== null && c.fill < 50 && c.capacity! > 0).sort((a, b) => (a.fill ?? 0) - (b.fill ?? 0));
  const missingRegisters = held.filter(l => l.registerComplete === false).length;
  const missedStarts = held.filter(l => !l.started && l.expected > 0).length;
  const stuck = buildProgression(ds).levels.reduce((s, l) => s + l.stuck, 0);
  const leaving = moves.leaving.filter(e => e.place.inScope).length;

  return {
    swimmers: comparison(now.swimmers.size, startCount),
    places: now.places,
    fill: filled,
    waiting: { bookings: ds.waitlist.length, swimmers: waitingSwimmers.size },
    joined: comparison(inPeriod(moves.joins).length, inPrevious(moves.joins).length),
    newSwimmers: inPeriod(moves.joins).filter(e => !e.returning).length,
    left: comparison(inPeriod(moves.leaves).length, inPrevious(moves.leaves).length),
    retention: retention(ds.places, addDaysIso(period.start, -1), period.today),
    attendance: comparison(attendanceRate(held), attendanceRate(heldBefore)),
    registers: comparison(registerRate(held), registerRate(heldBefore)),
    passes: comparison(passes(period.start, period.end), passes(period.previousStart, period.previousEnd)),
    lessons: { held: held.length, cancelled: ds.lessons.filter(l => l.cancelled && within(l.date, period.start, period.end)).length },
    trend,
    ages: ageProfile(ds.places, period.today),
    attention: {
      atRisk, leaving, missingRegisters, missedStarts, stuck,
      fullWithWaiting: fullWithWaiting.slice(0, 5), quiet: quiet.slice(0, 5),
      fullCount: fullWithWaiting.length, quietCount: quiet.length,
    },
    reasons: countBy(inPeriod(moves.leaves).map(e => e.reason ?? "none")).map(r => ({ ...r, label: reasonLabel(r.key) })),
  };
}

const studentIndex = new WeakMap<PlaceRow[], Map<string, PlaceRow[]>>();
/** A swimmer's places, looked up without scanning every place each time. */
function placesOf(places: PlaceRow[], studentId: string) {
  let index = studentIndex.get(places);
  if (!index) {
    index = new Map();
    for (const p of places) index.set(p.studentId, [...index.get(p.studentId) ?? [], p]);
    studentIndex.set(places, index);
  }
  return index.get(studentId) ?? [];
}

function placeAt(places: PlaceRow[], studentId: string, levelId: string, date: string, resolve: (id: string) => string) {
  const level = resolve(levelId);
  const rows = placesOf(places, studentId).filter(p => resolve(p.levelId) === level && p.startedOn <= date);
  return rows.sort((a, b) => (b.endOn ?? "9999").localeCompare(a.endOn ?? "9999"))[0];
}

// ---------------------------------------------------------------------------
// Classes
// ---------------------------------------------------------------------------

export type ClassRow = ReturnType<typeof buildClassRows>[number];

export function buildClassRows(ds: Dataset) {
  const { period } = ds;
  const counts = placesByCourse(ds);
  const waiting = new Map<string, number>();
  for (const w of ds.waitlist) waiting.set(w.courseId, (waiting.get(w.courseId) ?? 0) + 1);
  const index = curriculumIndex(ds.curriculum);
  const lessons = group(ds.lessons.filter(l => within(l.date, period.start, period.end)), l => l.courseId);
  const places = group(ds.places, p => p.courseId);
  return liveCourses(ds).map(course => {
    const mine = lessons.get(course.id) ?? [];
    const own = places.get(course.id) ?? [];
    const held = mine.filter(l => l.finished && !l.cancelled);
    const enrolled = counts.get(course.id) ?? 0;
    const teachers = countBy(held.filter(l => l.teacher).map(l => l.teacher!.name));
    const ended = own.filter(p => p.endOn && within(p.endOn, period.start, period.end));
    return {
      id: course.id, name: courseName(course), levelName: index.level(course.levelId)?.name ?? course.levelName,
      programmeName: index.programmeOf(course.levelId)?.name ?? "", levelId: index.resolveLevel(course.levelId),
      dayOfWeek: course.dayOfWeek as DayOfWeek, startMinutes: course.startMinutes, durationMinutes: course.durationMinutes,
      location: course.location, siteName: course.siteName,
      enrolled, capacity: course.capacity, waiting: waiting.get(course.id) ?? 0,
      fill: course.capacity ? enrolled / course.capacity * 100 : null,
      attendance: attendanceRate(held), lessons: held.length, cancelled: mine.filter(l => l.cancelled).length,
      averageIn: held.length ? held.reduce((s, l) => s + l.present + l.late, 0) / held.length : null,
      joined: own.filter(p => within(p.startedOn, period.start, period.end)).length,
      left: ended.filter(p => p.status === "WITHDRAWN").length,
      movedOut: ended.filter(p => p.status === "TRANSFERRED" || p.status === "COMPLETED").length,
      teachers,
    };
  }).sort((a, b) => DAY_META[a.dayOfWeek].index - DAY_META[b.dayOfWeek].index || a.startMinutes - b.startMinutes || a.name.localeCompare(b.name));
}

export function buildClasses(ds: Dataset) {
  const rows = buildClassRows(ds);
  const days = (Object.keys(DAY_META) as DayOfWeek[]).filter(day => rows.some(r => r.dayOfWeek === day));
  const hours = [...new Set(rows.map(r => Math.floor(r.startMinutes / 60)))].sort((a, b) => a - b);
  const heat = hours.map(hour => ({
    hour,
    cells: days.map(day => {
      const slot = rows.filter(r => r.dayOfWeek === day && Math.floor(r.startMinutes / 60) === hour);
      const capped = slot.filter(r => r.capacity !== null);
      const capacity = capped.reduce((s, r) => s + r.capacity!, 0);
      const enrolled = capped.reduce((s, r) => s + r.enrolled, 0);
      return { day, classes: slot.length, enrolled: capacity ? enrolled : slot.reduce((s, r) => s + r.enrolled, 0), capacity, waiting: slot.reduce((s, r) => s + r.waiting, 0), fill: pct(enrolled, capacity) };
    }),
  }));
  const index = curriculumIndex(ds.curriculum);
  const byLevel = new Map<string, ClassRow[]>();
  for (const r of rows) byLevel.set(r.levelId, [...byLevel.get(r.levelId) ?? [], r]);
  const levels = [...byLevel.entries()].sort(([a], [b]) => index.compare(a, b)).map(([levelId, list]) => {
    const capped = list.filter(r => r.capacity !== null);
    const capacity = capped.reduce((s, r) => s + r.capacity!, 0);
    return {
      levelId, name: index.level(levelId)?.name ?? list[0].levelName, programmeName: list[0].programmeName,
      classes: list.length, enrolled: list.reduce((s, r) => s + r.enrolled, 0), capacity,
      fill: pct(capped.reduce((s, r) => s + r.enrolled, 0), capacity), waiting: list.reduce((s, r) => s + r.waiting, 0),
      empty: Math.max(0, capacity - capped.reduce((s, r) => s + r.enrolled, 0)),
    };
  });
  return { rows, days, heat, levels, totals: fill(ds), waiting: ds.waitlist.length };
}

/** One class: its swimmers now, its waiting list, every lesson and who taught it. */
export function buildClass(ds: Dataset, courseId: string, names: Names) {
  const course = ds.courses.find(c => c.id === courseId);
  if (!course) return null;
  const { period } = ds;
  const { marks, spans, moves } = basics(ds);
  const index = curriculumIndex(ds.curriculum);
  const level = index.resolveLevel(course.levelId);
  const progress = skillProgress(ds, index);
  const attendance = new Map(ds.studentCourses.filter(r => r.courseId === courseId).map(r => [r.studentId, r]));
  const roster = ds.places.filter(p => p.courseId === courseId && p.startedOn <= period.today && (p.endOn === null || p.endOn > period.today)).map(p => {
    const risk = attendanceRisk((marks.get(p.studentId) ?? []).filter(m => m.courseId === courseId));
    const span = spans.get(p.studentId)?.find(s => s.start <= period.today && (s.end === null || s.end > period.today));
    const atLevel = span ? span.places.filter(q => index.resolveLevel(q.levelId) === level).map(q => q.startedOn).sort()[0] : p.startedOn;
    const register = attendance.get(p.studentId);
    return {
      studentId: p.studentId, ...nameOf(names, p.studentId),
      weeksInClass: weeksBetween(p.startedOn, period.today), weeksAtLevel: weeksBetween(atLevel ?? p.startedOn, period.today),
      attendance: register ? pct(register.attended, register.marked) : null, marked: register?.marked ?? 0,
      recent: (marks.get(p.studentId) ?? []).filter(m => m.courseId === courseId).slice(0, 6).map(m => ({ date: m.date, status: m.status })),
      skills: progress.get(p.studentId) ?? null,
      risk: risk.reasons, leavingOn: p.endOn, leaveReason: p.leaveReason,
    };
  }).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
  const lessons = ds.lessons.filter(l => l.courseId === courseId && within(l.date, period.start, period.end)).sort((a, b) => b.date.localeCompare(a.date));
  const held = lessons.filter(l => l.finished && !l.cancelled);
  const waiting = ds.waitlist.filter(w => w.courseId === courseId).sort((a, b) => a.since.localeCompare(b.since)).map(w => ({ studentId: w.studentId, ...nameOf(names, w.studentId), since: w.since, weeks: weeksBetween(w.since, period.today) }));
  const leavers = moves.leaves.filter(e => e.place.courseId === courseId && within(e.date, period.start, period.end)).map(e => ({ studentId: e.studentId, ...nameOf(names, e.studentId), date: e.date, weeks: e.weeks, reason: reasonLabel(e.reason ?? "none") }));
  return {
    id: course.id, name: courseName(course), levelName: index.level(course.levelId)?.name ?? course.levelName,
    programmeName: index.programmeOf(course.levelId)?.name ?? "", slot: { ...courseSlot(course), durationMinutes: course.durationMinutes },
    location: course.location, siteName: course.siteName, capacity: course.capacity, archived: course.archived,
    enrolled: roster.length, attendance: attendanceRate(held), registers: registerRate(held), lessonsHeld: held.length,
    cancelled: lessons.filter(l => l.cancelled).length, teachers: countBy(held.filter(l => l.teacher).map(l => l.teacher!.name)),
    roster, waiting, leavers,
    lessons: lessons.map(l => ({
      date: l.date, finished: l.finished, cancelled: l.cancelled, cancelReason: l.cancelReason, started: l.started,
      teacher: l.teacher, planned: l.planned, cover: l.cover, startOffset: l.startOffset,
      expected: l.expected, marked: l.marked, came: l.present + l.late, registerComplete: l.registerComplete,
    })),
  };
}

function nameOf(names: Names, id: string) {
  const row = names.get(id);
  const [firstName, ...rest] = (row?.name ?? "Unknown swimmer").split(" ");
  return { name: row?.name ?? "Unknown swimmer", firstName, lastName: rest.join(" "), memberNumber: row?.memberNumber ?? null };
}

/** Each current swimmer's share of the skills at the level of their place. */
function skillProgress(ds: Dataset, index: ReturnType<typeof curriculumIndex>) {
  const byStudent = new Map<string, ResultRow[]>();
  for (const r of ds.results) byStudent.set(r.studentId, [...byStudent.get(r.studentId) ?? [], r]);
  const out = new Map<string, { achieved: number; total: number }>();
  for (const p of ds.places) {
    if (!p.inScope || p.startedOn > ds.period.today || (p.endOn !== null && p.endOn <= ds.period.today)) continue;
    const skills = index.skills.get(index.resolveLevel(p.levelId)) ?? [];
    if (!skills.length) continue;
    const latest = latestSharedMarks(byStudent.get(p.studentId) ?? [], index.resolveCompetency);
    const achieved = new Set(latest.filter(r => r.status === "ACHIEVED").map(r => r.competencyId));
    out.set(p.studentId, { achieved: skills.filter(s => achieved.has(s.id)).length, total: skills.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Swimmers: who stays, who leaves, who might
// ---------------------------------------------------------------------------

export function buildSwimmers(ds: Dataset, names: Names) {
  const { period } = ds;
  const { moves, now, marks, lastTeacherOf } = basics(ds);
  const index = curriculumIndex(ds.curriculum);
  const courses = new Map(ds.courses.map(c => [c.id, c]));
  const months = monthlyMovement(ds.places, moves.joins, moves.leaves, lastMonths(period.today, 12), period.today);
  const leaves = moves.leaves.filter(e => within(e.date, period.start, period.end));
  const joins = moves.joins.filter(e => within(e.date, period.start, period.end));
  const describe = (e: LeaveEvent) => {
    const course = courses.get(e.place.courseId);
    const recent = marks.get(e.studentId) ?? [];
    const before = recent.filter(m => m.date < e.date).slice(0, 8);
    return {
      studentId: e.studentId, ...nameOf(names, e.studentId), date: e.date, weeks: e.weeks,
      className: course ? courseName(course) : "Class removed", courseId: e.place.courseId,
      slot: course ? courseSlot(course) : null, siteName: course?.siteName ?? "",
      levelName: index.level(e.place.levelId)?.name ?? "", reasonKey: e.reason ?? "none", reason: reasonLabel(e.reason ?? "none"),
      teacher: lastTeacherOf.get(e.studentId)?.name ?? null,
      attended: before.filter(m => m.status !== "ABSENT").length, marked: before.length,
    };
  };
  const levels = new Map<string, number>();
  for (const e of leaves) { const id = index.resolveLevel(e.place.levelId); levels.set(id, (levels.get(id) ?? 0) + 1); }
  const atRisk = [...now.swimmers].map(id => {
    const rows = marks.get(id) ?? [];
    const risk = attendanceRisk(rows);
    if (!risk.reasons.length) return null;
    const own = placesOf(ds.places, id).filter(p => p.inScope && p.startedOn <= period.today && (p.endOn === null || p.endOn > period.today));
    const place = own.find(p => p.courseId === rows[0]?.courseId) ?? own[0];
    const course = place ? courses.get(place.courseId) : undefined;
    return {
      studentId: id, ...nameOf(names, id), reasons: risk.reasons, lastAttended: risk.lastAttended, missedInARow: risk.missedInARow,
      className: course ? courseName(course) : "", courseId: course?.id ?? null, slot: course ? courseSlot(course) : null,
      teacher: lastTeacherOf.get(id)?.name ?? null,
    };
  }).filter(x => x !== null).sort((a, b) => b.missedInARow - a.missedInARow || a.lastName.localeCompare(b.lastName));
  return {
    swimmers: now.swimmers.size,
    joined: joins.length, newSwimmers: joins.filter(e => !e.returning).length, returning: joins.filter(e => e.returning).length,
    left: leaves.length,
    retention: retention(ds.places, addDaysIso(period.start, -1), period.today),
    months,
    tenure: TENURE_BANDS.map(band => ({ label: band.label, count: leaves.filter(e => tenureBand(e.weeks).key === band.key).length })),
    reasons: countBy(leaves.map(e => e.reason ?? "none")).map(r => ({ ...r, label: reasonLabel(r.key) })),
    byLevel: [...levels.entries()].sort(([a], [b]) => index.compare(a, b)).map(([id, count]) => ({ name: index.level(id)?.name ?? "", programmeName: index.programmeOf(id)?.name ?? "", count })),
    leavers: leaves.map(describe).sort((a, b) => b.date.localeCompare(a.date)),
    leaving: moves.leaving.filter(e => e.place.inScope).map(describe).sort((a, b) => a.date.localeCompare(b.date)),
    atRisk,
    ages: ageProfile(ds.places, period.today),
  };
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export function buildProgression(ds: Dataset) {
  const { period } = ds;
  const index = curriculumIndex(ds.curriculum);
  const spans = swimmerSpans(ds.places);
  const progress = skillProgress(ds, index);
  const byStudent = new Map<string, ResultRow[]>();
  for (const r of ds.results) byStudent.set(r.studentId, [...byStudent.get(r.studentId) ?? [], r]);
  const current = new Map<string, { studentId: string; weeks: number }[]>();
  for (const p of ds.places) {
    if (!p.inScope || p.startedOn > period.today || (p.endOn !== null && p.endOn <= period.today)) continue;
    const level = index.resolveLevel(p.levelId);
    const span = spans.get(p.studentId)?.find(s => s.start <= period.today && (s.end === null || s.end > period.today));
    const since = span?.places.filter(q => index.resolveLevel(q.levelId) === level).map(q => q.startedOn).sort()[0] ?? p.startedOn;
    const list = current.get(level) ?? [];
    if (!list.some(x => x.studentId === p.studentId)) list.push({ studentId: p.studentId, weeks: weeksBetween(since, period.today) });
    current.set(level, list);
  }
  const passesBy = new Map<string, number[]>();
  for (const c of ds.completions) {
    if (!within(c.completedOn, period.start, period.end)) continue;
    const level = index.resolveLevel(c.levelId);
    const place = placeAt(ds.places, c.studentId, c.levelId, c.completedOn, index.resolveLevel);
    if (!place?.inScope) continue;
    const first = placesOf(ds.places, c.studentId).filter(p => index.resolveLevel(p.levelId) === level && p.startedOn <= c.completedOn).map(p => p.startedOn).sort()[0];
    passesBy.set(level, [...passesBy.get(level) ?? [], first ? weeksBetween(first, c.completedOn) : NaN]);
  }
  const waiting = new Map<string, number>();
  for (const w of ds.waitlist) { const id = index.resolveLevel(w.levelId); waiting.set(id, (waiting.get(id) ?? 0) + 1); }
  const ids = new Set([...current.keys(), ...passesBy.keys()]);
  const levels = [...ids].sort(index.compare).map(levelId => {
    const swimmers = current.get(levelId) ?? [];
    const weeks = (passesBy.get(levelId) ?? []).filter(Number.isFinite).sort((a, b) => a - b);
    const skills = index.skills.get(levelId) ?? [];
    const progressRows = swimmers.map(s => progress.get(s.studentId)).filter(x => x !== undefined);
    // The skill fewest current swimmers have: where the level tends to stall.
    let hardest: { name: string; achieved: number } | null = null;
    if (swimmers.length >= 3) for (const skill of skills) {
      const achieved = swimmers.filter(s => latestSharedMarks(byStudent.get(s.studentId) ?? [], index.resolveCompetency).some(r => r.competencyId === skill.id && r.status === "ACHIEVED")).length;
      const share = achieved / swimmers.length * 100;
      if (!hardest || share < hardest.achieved) hardest = { name: skill.name, achieved: share };
    }
    return {
      levelId, name: index.level(levelId)?.name ?? "", programmeName: index.programmeOf(levelId)?.name ?? "",
      swimmers: swimmers.length, passes: passesBy.get(levelId)?.length ?? 0,
      medianWeeks: weeks.length ? weeks[Math.floor((weeks.length - 1) / 2)] : null,
      stuck: swimmers.filter(s => s.weeks > STUCK_WEEKS).length,
      averageWeeks: swimmers.length ? swimmers.reduce((s, x) => s + x.weeks, 0) / swimmers.length : null,
      skills: skills.length,
      skillsDone: progressRows.length ? progressRows.reduce((s, r) => s + r.achieved / r.total, 0) / progressRows.length * 100 : null,
      hardest, waiting: waiting.get(levelId) ?? 0,
    };
  });
  const bookings = ds.assessments.filter(a => a.status !== null && within(a.date, period.start, period.end));
  const sessions = new Set(ds.assessments.filter(a => within(a.date, period.start, period.end) && !a.sessionCancelled).map(a => a.sessionId));
  const attended = bookings.filter(b => b.status === "ATTENDED");
  const converted = attended.filter(b => b.studentId && placesOf(ds.places, b.studentId).some(p => p.startedOn >= b.date && p.startedOn <= addDaysIso(b.date, 30)));
  // Days from the assessment to the first lesson in a class, for those who started within two months.
  const waits = attended.flatMap(b => {
    const first = b.studentId ? placesOf(ds.places, b.studentId).map(p => p.startedOn).filter(d => d >= b.date && d <= addDaysIso(b.date, 60)).sort()[0] : undefined;
    return first ? [Math.round((Date.parse(first) - Date.parse(b.date)) / 86_400_000)] : [];
  }).sort((a, b) => a - b);
  return {
    levels,
    passes: levels.reduce((s, l) => s + l.passes, 0),
    stuck: levels.reduce((s, l) => s + l.stuck, 0),
    assessments: {
      sessions: sessions.size, booked: bookings.length, attended: attended.length,
      noShow: bookings.filter(b => b.status === "NO_SHOW").length, cancelled: bookings.filter(b => b.status === "CANCELLED").length,
      upcoming: bookings.filter(b => b.status === "BOOKED").length,
      placed: attended.filter(b => b.outcomeLevelId).length, converted: converted.length, conversion: pct(converted.length, attended.length),
      daysToClass: waits.length ? waits[Math.floor((waits.length - 1) / 2)] : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Teachers
// ---------------------------------------------------------------------------

function teachersFor(ds: Dataset, from: string, to: string) {
  const { moves, lastTeacherOf } = basics(ds);
  const scopedCompletions = ds.completions.filter(c => placeAt(ds.places, c.studentId, c.levelId, c.completedOn, curriculumIndex(ds.curriculum).resolveLevel)?.inScope);
  return teacherStats({
    lessons: ds.lessons, from, to, studentTeachers: ds.studentTeachers, ticks: ds.ticks, completions: scopedCompletions,
    leaves: moves.leaves, lastTeacherOf,
  });
}

export function buildTeachers(ds: Dataset) {
  const { period } = ds;
  const teachers = teachersFor(ds, period.start, period.end);
  const held = heldLessons(ds.lessons, period.start, period.end);
  return {
    teachers: teachers.map(t => ({ ...t, leaverReasons: t.leaverReasons.map(r => ({ ...r, label: reasonLabel(r.key) })) })),
    school: schoolAverages(teachers, held),
    lessons: held.length, notStarted: held.filter(l => !l.started && l.expected > 0).length,
  };
}

/** One teacher: their figures against the school, week by week, their
 *  classes, the swimmers who left after their lessons and their late starts. */
export function buildTeacher(ds: Dataset, key: string, names: Names) {
  const { period } = ds;
  const all = teachersFor(ds, period.start, period.end);
  const me = all.find(t => t.key === key);
  if (!me) return null;
  const { moves, lastTeacherOf, marks } = basics(ds);
  const held = heldLessons(ds.lessons, period.start, period.end);
  const mine = held.filter(l => l.started && l.teacher?.key === key);
  const courses = new Map(ds.courses.map(c => [c.id, c]));
  const weeks = period.weeks.map(week => {
    const end = addDaysIso(week, 6);
    const rows = mine.filter(l => within(l.date, week, end));
    return { week, lessons: rows.length, attendance: attendanceRate(rows), onTime: rows.filter(l => l.onTime !== null).length ? rows.filter(l => l.onTime).length / rows.filter(l => l.onTime !== null).length * 100 : null };
  });
  const byCourse = new Map<string, Lesson[]>();
  for (const l of mine) byCourse.set(l.courseId, [...byCourse.get(l.courseId) ?? [], l]);
  const classes = [...byCourse.entries()].map(([courseId, rows]) => {
    const course = courses.get(courseId);
    return {
      courseId, name: course ? courseName(course) : "Class removed", slot: course ? courseSlot(course) : null, siteName: course?.siteName ?? "",
      lessons: rows.length, attendance: attendanceRate(rows), registers: registerRate(rows),
      cover: rows.filter(l => l.cover).length, lastTaught: rows.map(l => l.date).sort().at(-1)!,
    };
  }).sort((a, b) => b.lessons - a.lessons);
  const leavers = moves.leaves.filter(e => within(e.date, period.start, period.end) && lastTeacherOf.get(e.studentId)?.key === key).map(e => {
    const course = courses.get(e.place.courseId);
    const before = (marks.get(e.studentId) ?? []).filter(m => m.date < e.date).slice(0, 8);
    return {
      studentId: e.studentId, ...nameOf(names, e.studentId), date: e.date, weeks: e.weeks,
      className: course ? courseName(course) : "", reason: reasonLabel(e.reason ?? "none"),
      attended: before.filter(m => m.status !== "ABSENT").length, marked: before.length,
    };
  }).sort((a, b) => b.date.localeCompare(a.date));
  const late = mine.filter(l => l.onTime === false).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map(l => ({
    date: l.date, courseId: l.courseId, className: courses.get(l.courseId) ? courseName(courses.get(l.courseId)!) : "", startMinutes: l.startMinutes, minutes: l.startOffset ?? 0,
  }));
  const missed = held.filter(l => !l.started && l.planned?.key === key && l.expected > 0).sort((a, b) => b.date.localeCompare(a.date)).map(l => ({
    date: l.date, courseId: l.courseId, className: courses.get(l.courseId) ? courseName(courses.get(l.courseId)!) : "", startMinutes: l.startMinutes, marked: l.marked,
  }));
  return {
    teacher: { ...me, leaverReasons: me.leaverReasons.map(r => ({ ...r, label: reasonLabel(r.key) })) },
    school: schoolAverages(all, held), weeks, classes, leavers, late, missed,
  };
}
