import { AuthorizationError, canSee, requireSession } from "@/lib/authz";
import { getCurrentClub } from "@/lib/clubs/current";
import { addDaysIso, minutesNow } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  assessmentsQuery, completionsQuery, coursesQuery, lessonsQuery, placesQuery, recentMarksQuery, resultsQuery,
  studentCourseQuery, studentTeacherQuery, ticksQuery, waitlistQuery,
  type AssessmentRow, type CompletionRow, type CourseRow, type LessonRow, type MarkRow, type PlaceRow, type ResultRow,
  type StudentCourseRow, type StudentTeacherRow, type TickRow, type WaitlistRow,
} from "@/modules/activities/features/analytics/server/insight-queries";
import {
  buildClass, buildClasses, buildOverview, buildProgression, buildSwimmers, buildTeacher, buildTeachers, type Dataset, type Names,
} from "@/modules/activities/features/analytics/server/insights";
import { parentLinksQuery, type ParentLinkRow } from "@/modules/activities/features/analytics/server/desk-queries";
import { deskOverdue } from "@/modules/activities/features/analytics/server/desk-overdue";
import { attendanceBySlot, cancellations, continuity, forecast, parentTakeUp, stayCurves } from "@/modules/activities/features/analytics/server/extras";
import { swimmerSpans } from "@/modules/activities/features/analytics/server/swimmers";
import { periodFrom, siteScope, type ReportFilters } from "@/modules/activities/features/analytics/server/period";
import { forProgramme, programmeOptions } from "@/modules/activities/features/analytics/server/programme-filter";
import { readLessons } from "@/modules/activities/features/analytics/server/teaching";

export type ReportParams = { range?: string | string[]; sites?: string | string[]; from?: string | string[]; to?: string | string[]; programme?: string | string[] };

/** Who may read the reports and which sites they cover. Analytics needs the
 *  swim school's top level (`courses.manage`, the "analytics" screen), which
 *  also covers the teacher figures. */
export async function context(params: ReportParams, now: Date) {
  const session = await requireSession();
  if (!canSee(session, "analytics")) throw new AuthorizationError("Analytics access is required.");
  const { club, clubs } = await getCurrentClub();
  const allSites = siteScope(params.sites) === "all" && clubs.length > 1;
  const period = periodFrom(params, now);
  const programmes = programmeOptions({ programmes: await prisma.programme.findMany({ select: { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true } }) });
  const wanted = Array.isArray(params.programme) ? params.programme[0] : params.programme;
  const programme = programmes.find(p => p.id === wanted) ?? null;
  const filters: ReportFilters = { period, scope: allSites ? "all" : "site", programme: programme?.id ?? null };
  return {
    session, period, filters, programmes, programme, allSites, multipleSites: clubs.length > 1,
    clubIds: allSites ? clubs.map(c => c.id) : [club.id], siteName: allSites ? "All sites" : club.name,
    updatedAt: now.toISOString(),
    canOpenClasses: canSee(session, "courses"), canOpenSwimmers: canSee(session, "students"),
  };
}

type Need = { lessons?: boolean; teaching?: boolean; marks?: boolean; register?: boolean; progress?: boolean; assessments?: boolean };

async function dataset(clubIds: string[], period: Dataset["period"], now: Date, need: Need, programmeId: string | null = null): Promise<Dataset> {
  const since = period.previousStart;
  // A year back for the monthly movement and a leaver's last teacher.
  const history = addDaysIso(period.today, -400) < since ? addDaysIso(period.today, -400) : since;
  const [allPlaces, allWaitlist, allCourses, lessonRows, allStudentTeachers, allMarks, allStudentCourses, allCompletions, allTicks, allAssessments, programmes, levels, competencies] = await prisma.$transaction(async tx => Promise.all([
    tx.$queryRaw<PlaceRow[]>(placesQuery(clubIds)),
    tx.$queryRaw<WaitlistRow[]>(waitlistQuery(clubIds)),
    tx.$queryRaw<CourseRow[]>(coursesQuery(clubIds, since)),
    need.lessons ? tx.$queryRaw<LessonRow[]>(lessonsQuery(clubIds, since, period.today)) : [],
    need.teaching ? tx.$queryRaw<StudentTeacherRow[]>(studentTeacherQuery(clubIds, history, period.start, period.today)) : [],
    need.marks ? tx.$queryRaw<MarkRow[]>(recentMarksQuery(clubIds)) : [],
    need.register ? tx.$queryRaw<StudentCourseRow[]>(studentCourseQuery(clubIds, period.start, period.today)) : [],
    tx.$queryRaw<CompletionRow[]>(completionsQuery(clubIds, since)),
    need.teaching ? tx.$queryRaw<TickRow[]>(ticksQuery(clubIds, since)) : [],
    need.assessments ? tx.$queryRaw<AssessmentRow[]>(assessmentsQuery(clubIds, since, period.today)) : [],
    tx.programme.findMany({ select: { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true } }),
    tx.level.findMany({ select: { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true, programmeId: true } }),
    tx.competency.findMany({ select: { id: true, sharedWithId: true, name: true, sortOrder: true, archivedAt: true, levelId: true } }),
  ]), { isolationLevel: "RepeatableRead", timeout: 30_000 });
  const curriculum = { programmes, levels, competencies };
  const { places, waitlist, courses, lessons, studentTeachers, marks, studentCourses, completions, ticks, assessments } = forProgramme({
    places: allPlaces, waitlist: allWaitlist, courses: allCourses, lessons: lessonRows, studentTeachers: allStudentTeachers, marks: allMarks,
    studentCourses: allStudentCourses, completions: allCompletions, ticks: allTicks, results: [], assessments: allAssessments, curriculum,
  }, programmeId);
  let results: ResultRow[] = [];
  if (need.progress) {
    const current = [...new Set(places.filter(p => p.inScope && p.startedOn <= period.today && (p.endOn === null || p.endOn > period.today)).map(p => p.studentId))];
    const sql = resultsQuery(current);
    if (sql) results = forProgramme({ places, waitlist, courses, lessons, studentTeachers, marks, studentCourses, completions, ticks, assessments, curriculum, results: await prisma.$queryRaw<ResultRow[]>(sql) }, programmeId).results;
  }
  // A custom period that ended before today reads its last day as finished.
  const minutes = period.current ? minutesNow(now) : 24 * 60;
  return {
    period, minutes, places, waitlist, courses,
    lessons: readLessons(lessons, period.today, minutes),
    studentTeachers, marks, studentCourses, completions, ticks, results, assessments, curriculum,
  };
}

/** Names and member numbers for the swimmers a page lists; never contact or medical details. */
async function names(ids: Iterable<string>): Promise<Names> {
  const list = [...new Set(ids)];
  if (!list.length) return new Map();
  const rows = await prisma.student.findMany({ where: { id: { in: list } }, select: { id: true, firstName: true, lastName: true, memberNumber: true } });
  return new Map(rows.map(r => [r.id, { name: `${r.firstName} ${r.lastName}`, memberNumber: r.memberNumber }]));
}

const everything: Need = { lessons: true, teaching: true, marks: true, register: true, progress: true, assessments: true };

export async function getOverviewInsights(params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { lessons: true, marks: true, progress: true }, ctx.filters.programme);
  return { ...ctx, session: undefined, overview: buildOverview(ds), deskOverdue: await deskOverdue(ctx.clubIds, now) };
}

export async function getClassesInsights(params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { lessons: true }, ctx.filters.programme);
  const { period } = ctx;
  return {
    ...ctx, session: undefined, classes: buildClasses(ds),
    forecast: forecast(ds.places, ds.courses, ds.waitlist, period.now),
    slots: attendanceBySlot(ds.lessons, ds.courses, period.start, period.end),
    cancellations: cancellations(ds.lessons, period),
    continuity: continuity(ds.lessons, ds.courses, period.start, period.end),
  };
}

export async function getClassInsights(courseId: string, params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { lessons: true, marks: true, register: true, progress: true });
  const ids = [...ds.places.filter(p => p.courseId === courseId).map(p => p.studentId), ...ds.waitlist.filter(w => w.courseId === courseId).map(w => w.studentId)];
  return { ...ctx, session: undefined, course: buildClass(ds, courseId, await names(ids)) };
}

export async function getSwimmerInsights(params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { marks: true }, ctx.filters.programme);
  const first = buildSwimmers(ds, new Map());
  const ids = [...first.leavers, ...first.leaving, ...first.atRisk].map(s => s.studentId);
  const links = await prisma.$queryRaw<ParentLinkRow[]>(parentLinksQuery(ctx.clubIds));
  return {
    ...ctx, session: undefined, swimmers: buildSwimmers(ds, await names(ids)),
    stay: stayCurves(swimmerSpans(ds.places), ctx.period.today),
    parents: parentTakeUp(ds.places, links, ctx.period.today, ctx.period.start, ctx.period.end),
  };
}

export async function getProgressionInsights(params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { progress: true, assessments: true }, ctx.filters.programme);
  return { ...ctx, session: undefined, progression: buildProgression(ds) };
}

export async function getTeacherInsights(params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { ...everything, register: false, progress: false, assessments: false }, ctx.filters.programme);
  return { ...ctx, session: undefined, teachers: buildTeachers(ds), continuity: continuity(ds.lessons, ds.courses, ctx.period.start, ctx.period.end) };
}

export async function getOneTeacherInsights(key: string, params: ReportParams, now = new Date()) {
  const ctx = await context(params, now);
  const ds = await dataset(ctx.clubIds, ctx.period, now, { ...everything, register: false, progress: false, assessments: false }, ctx.filters.programme);
  const first = buildTeacher(ds, key, new Map());
  return { ...ctx, session: undefined, detail: first ? buildTeacher(ds, key, await names(first.leavers.map(l => l.studentId))) : null };
}

export type InsightContext = Omit<Awaited<ReturnType<typeof context>>, "session">;
export type OverviewInsights = Awaited<ReturnType<typeof getOverviewInsights>>;
export type ClassesInsights = Awaited<ReturnType<typeof getClassesInsights>>;
export type ClassInsights = Awaited<ReturnType<typeof getClassInsights>>;
export type SwimmerInsights = Awaited<ReturnType<typeof getSwimmerInsights>>;
export type ProgressionInsights = Awaited<ReturnType<typeof getProgressionInsights>>;
export type TeacherInsights = Awaited<ReturnType<typeof getTeacherInsights>>;
export type OneTeacherInsights = Awaited<ReturnType<typeof getOneTeacherInsights>>;
