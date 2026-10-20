import type { DayOfWeek } from "@/generated/prisma/client";
import { addDaysIso } from "@/lib/format";
import { DAY_META } from "@/modules/activities/shared/courses/constants";
import type { CourseRow, PlaceRow, WaitlistRow } from "@/modules/activities/features/analytics/server/insight-queries";
import { courseSlot } from "@/modules/activities/features/analytics/server/insights";
import type { ParentLinkRow } from "@/modules/activities/features/analytics/server/desk-queries";
import { activeAt, within, type Span } from "@/modules/activities/features/analytics/server/swimmers";
import { attendanceRate, countBy, heldLessons, type Lesson } from "@/modules/activities/features/analytics/server/teaching";

/* Round two of the swim school reports (owner request, 16 October 2026: "give me much more data"):
 * how long new swimmers stay, the next four weeks, attendance by time slot, cancelled lessons, the
 * same teacher each week and parent app take-up. Plain functions over the rows the reports already
 * read, so they are tested without a database. */

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : null);

/** Weeks after joining at which we look whether a new swimmer is still swimming. */
const STAY_MILESTONES = [4, 8, 13, 26, 52] as const;

function quarterOf(date: string) {
  const [y, m] = date.split("-").map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}
const QUARTER_LABEL = ["Jan to Mar", "Apr to Jun", "Jul to Sep", "Oct to Dec"];
function quarterLabel(key: string) {
  const [y, q] = key.split("-Q");
  return `${QUARTER_LABEL[Number(q) - 1]} ${y}`;
}

/** Stay curves: of the new swimmers who joined in each of the last six quarters (first time at the swim
 *  school, at these sites), the share still swimming 4, 8, 13, 26 and 52 weeks later. Only swimmers who
 *  joined long enough ago count towards each milestone; a milestone nobody has reached yet is blank. Returning swimmers are left out. */
export function stayCurves(spans: Map<string, Span[]>, today: string, quarters = 6) {
  const firsts: Span[] = [];
  for (const list of spans.values()) for (const span of list) if (span.first && span.firstPlace.inScope && span.start <= today) firsts.push(span);
  const keys = [...new Set(firsts.map(s => quarterOf(s.start)))].sort().slice(-quarters);
  const share = (list: Span[], weeks: number) => {
    const due = list.filter(s => addDaysIso(s.start, weeks * 7) <= today);
    if (!due.length) return null;
    return pct(due.filter(s => s.end === null || s.end > addDaysIso(s.start, weeks * 7)).length, due.length);
  };
  const overall = (weeks: number) => {
    const due = firsts.filter(s => addDaysIso(s.start, weeks * 7) <= today && s.start >= addDaysIso(today, -730));
    return pct(due.filter(s => s.end === null || s.end > addDaysIso(s.start, weeks * 7)).length, due.length);
  };
  return {
    milestones: [...STAY_MILESTONES],
    overall: STAY_MILESTONES.map(overall),
    cohorts: keys.map(key => {
      const list = firsts.filter(s => quarterOf(s.start) === key);
      return { key, label: quarterLabel(key), joined: list.length, values: STAY_MILESTONES.map(w => share(list, w)) };
    }),
  };
}

/** The next four weeks: places held on each coming Monday-to-Monday step against the live classes'
 *  capacity, with the places starting and ending in each week (booked last lessons, moves already
 *  made). Only what is already booked: new joiners are not guessed. */
export function forecast(places: PlaceRow[], courses: CourseRow[], waitlist: WaitlistRow[], today: string) {
  const live = courses.filter(c => !c.archived);
  const capped = new Set(live.filter(c => c.capacity !== null).map(c => c.id));
  const capacity = live.reduce((s, c) => s + (c.capacity ?? 0), 0);
  const scoped = places.filter(p => p.inScope);
  const weeks = [0, 1, 2, 3, 4].map(k => addDaysIso(today, k * 7));
  return {
    capacity, waiting: waitlist.length,
    weeks: weeks.map((date, k) => {
      const held = scoped.filter(p => p.startedOn <= date && (p.endOn === null || p.endOn > date));
      const before = k ? weeks[k - 1] : null;
      return {
        date, places: held.length, swimmers: activeAt(places, date).swimmers.size,
        fill: pct(held.filter(p => capped.has(p.courseId)).length, capacity),
        starting: before ? scoped.filter(p => p.startedOn > before && p.startedOn <= date).length : 0,
        ending: before ? scoped.filter(p => p.endOn !== null && p.endOn > before && p.endOn <= date).length : 0,
      };
    }),
  };
}

/** Attendance by day and class start time across the lessons held in the period. */
export function attendanceBySlot(lessons: Lesson[], courses: CourseRow[], from: string, to: string) {
  const day = new Map(courses.map(c => [c.id, c.dayOfWeek as DayOfWeek]));
  const held = heldLessons(lessons, from, to).filter(l => l.marked > 0 && day.has(l.courseId));
  const days = (Object.keys(DAY_META) as DayOfWeek[]).filter(d => held.some(l => day.get(l.courseId) === d)).sort((a, b) => DAY_META[a].index - DAY_META[b].index);
  const starts = [...new Set(held.map(l => l.startMinutes))].sort((a, b) => a - b);
  return {
    days,
    heat: starts.map(start => ({
      start,
      cells: days.map(d => {
        const slot = held.filter(l => day.get(l.courseId) === d && l.startMinutes === start);
        return { day: d, lessons: slot.length, rate: attendanceRate(slot) };
      }),
    })),
  };
}

/** Lessons cancelled in the period, the swimmers they affected and why, against the period before. */
export function cancellations(lessons: Lesson[], period: { start: string; end: string; previousStart: string; previousEnd: string }) {
  const now = lessons.filter(l => l.cancelled && within(l.date, period.start, period.end));
  const before = lessons.filter(l => l.cancelled && within(l.date, period.previousStart, period.previousEnd));
  const scheduled = lessons.filter(l => within(l.date, period.start, period.end)).length;
  return {
    lessons: now.length, previous: before.length, swimmers: now.reduce((s, l) => s + l.expected, 0),
    share: pct(now.length, scheduled),
    reasons: countBy(now.map(l => l.cancelReason?.trim() || "No reason given")),
  };
}

/** The same teacher each week: for each class, the share of its lessons taught by the person who taught
 *  it most. Swimmers settle and progress better with one teacher, so low shares are worth a look. */
export function continuity(lessons: Lesson[], courses: CourseRow[], from: string, to: string) {
  const names = new Map(courses.map(c => [c.id, c]));
  const byCourse = new Map<string, Lesson[]>();
  for (const l of heldLessons(lessons, from, to)) if (l.started && l.teacher) byCourse.set(l.courseId, [...byCourse.get(l.courseId) ?? [], l]);
  let main = 0, total = 0;
  const classes = [...byCourse].map(([courseId, list]) => {
    const counts = countBy(list.map(l => l.teacher!.key));
    const top = counts[0];
    main += top.count; total += list.length;
    return {
      courseId, lessons: list.length, teachers: counts.length, share: pct(top.count, list.length)!,
      main: list.find(l => l.teacher!.key === top.key)!.teacher!.name,
      course: names.has(courseId) ? { name: names.get(courseId)!.name ?? names.get(courseId)!.levelName, slot: courseSlot(names.get(courseId)!), siteName: names.get(courseId)!.siteName } : null,
    };
  }).sort((a, b) => a.share - b.share || b.lessons - a.lessons);
  return { school: pct(main, total), classes };
}

/** Parent app take-up: of the swimmers here today, how many have a parent linked in the app, and how
 *  many were linked in the period. */
export function parentTakeUp(places: PlaceRow[], links: ParentLinkRow[], today: string, from: string, to: string) {
  const swimmers = activeAt(places, today).swimmers;
  const linked = new Map(links.map(l => [l.studentId, l.linkedOn]));
  const here = [...swimmers].filter(id => (linked.get(id) ?? "9999") <= today);
  return {
    swimmers: swimmers.size, linked: here.length, share: pct(here.length, swimmers.size),
    newLinks: [...swimmers].filter(id => within(linked.get(id) ?? "", from, to)).length,
  };
}
