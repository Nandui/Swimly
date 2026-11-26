import { activeStaffAccess, activeStaffHolding, liveSites, staffByIds } from "@/lib/directory";
import { sitesWhereOn } from "@/lib/apps/switches";
import { addDaysIso, formatTime, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { courseName } from "@/modules/activities/shared/courses/constants";
import { dayTeacherId } from "@/modules/activities/shared/courses/day-teacher";

/** Reads for the classes API. Everything that leaves is built field by field here (an
 *  allowlist): times, names of classes, programmes, levels and sites, and the teacher's name.
 *  Never a swimmer, a contact or a raw row. The router has already checked the app's key. */

export type ApiLesson = {
  /** The class's id: the same every week, for the other app to match on. */
  id: string;
  /** The day of this lesson, YYYY-MM-DD. */
  date: string;
  day: string;
  /** Clock times at the pool (Europe/Dublin), "15:10". */
  start: string;
  end: string;
  durationMinutes: number;
  name: string;
  programme: string;
  level: string;
  location: string | null;
  site: { id: string; name: string };
  /** Who teaches it that day; null when nobody is chosen yet. */
  instructor: { id: string; name: string } | null;
  /** The lesson has started: its teacher is on the register and can no longer be changed. */
  started: boolean;
};

/** The live sites where the swim school is on: the only sites the API speaks of. */
export async function apiSites() {
  const sites = await liveSites();
  const on = new Set(await sitesWhereOn("swim-school", sites.map((s) => s.id)));
  return sites.filter((s) => on.has(s.id));
}

/** Each lesson from `from` for `days` days, by day then time; cancelled lessons are left out.
 *  Its teacher is whoever started it, else whoever the rota's Plan has for that day. */
export async function listLessons({ from, days, siteId, classId }: { from: string; days: number; siteId?: string; classId?: string }): Promise<ApiLesson[]> {
  const sites = (await apiSites()).filter((s) => !siteId || s.id === siteId);
  if (sites.length === 0) return [];
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const dates = Array.from({ length: days }, (_, at) => addDaysIso(from, at));
  const range = { gte: parseDateOnly(dates[0]), lte: parseDateOnly(dates[dates.length - 1]) };
  const courses = await prisma.course.findMany({
    where: { archivedAt: null, clubId: { in: sites.map((s) => s.id) }, dayOfWeek: { in: [...new Set(dates.map(weekdayOfIso))] }, ...(classId ? { id: classId } : {}) },
    orderBy: [{ startMinutes: "asc" }, { id: "asc" }],
    select: { id: true, clubId: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, instructorId: true, name: true, location: true,
      level: { select: { name: true, programme: { select: { name: true } } } } },
  });
  if (courses.length === 0) return [];
  const ids = courses.map((c) => c.id);
  const [covers, planned, cancelled] = await Promise.all([
    prisma.classCover.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true, coverById: true, coverByName: true } }),
    prisma.classPlannedTeacher.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true, teacherId: true, teacherName: true } }),
    prisma.classCancellation.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true } }),
  ]);
  const key = (courseId: string, date: Date) => `${courseId}|${date.toISOString().slice(0, 10)}`;
  const coverBy = new Map(covers.map((c) => [key(c.courseId, c.date), c]));
  const plannedBy = new Map(planned.map((p) => [key(p.courseId, p.date), p]));
  const off = new Set(cancelled.map((c) => key(c.courseId, c.date)));
  const rows: Array<Omit<ApiLesson, "instructor"> & { teacherId: string | null; kept: string | null }> = [];
  for (const date of dates) {
    const weekday = weekdayOfIso(date);
    for (const c of courses) {
      const k = `${c.id}|${date}`;
      if (c.dayOfWeek !== weekday || off.has(k)) continue;
      const cover = coverBy.get(k), plan = plannedBy.get(k);
      const teacherId = cover ? cover.coverById : dayTeacherId(c.instructorId, plan, date);
      rows.push({ id: c.id, date, day: c.dayOfWeek, start: formatTime(c.startMinutes), end: formatTime(c.startMinutes + c.durationMinutes), durationMinutes: c.durationMinutes,
        name: courseName(c), programme: c.level.programme.name, level: c.level.name, location: c.location, site: { id: c.clubId, name: siteName.get(c.clubId) ?? "" },
        started: Boolean(cover), teacherId, kept: cover ? cover.coverByName : plan?.teacherName ?? null });
    }
  }
  const names = await staffByIds(rows.map((r) => r.teacherId));
  return rows.map(({ teacherId, kept, ...row }) => ({ ...row, instructor: teacherId ? { id: teacherId, name: names.get(teacherId)?.name ?? kept ?? "Former staff" } : null }));
}

/** Who a class can be given to: active staff whose access lets them take a register, the same
 *  people the swim school has always offered as teachers. Names and ids only. */
export async function listInstructors() {
  return (await activeStaffHolding(["attendance.mark", "attendance.markAny"])).map(({ id, name }) => ({ id, name }));
}

const plain = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/** The people who can teach matching an id, a work email or a full name. A name can match more
 *  than one person; the caller refuses that. Emails are matched, never sent out. */
export async function findInstructors(by: { id: string } | { email: string } | { name: string }) {
  const teachers = await listInstructors();
  if ("id" in by) return teachers.filter((t) => t.id === by.id);
  if ("name" in by) return teachers.filter((t) => plain(t.name) === plain(by.name));
  const emails = new Map((await activeStaffAccess(teachers.map((t) => t.id))).map((s) => [s.id, plain(s.email)]));
  return teachers.filter((t) => emails.get(t.id) === plain(by.email));
}

/** The site of a class on the timetable, when the swim school is on there. */
export async function classSite(classId: string) {
  const course = await prisma.course.findFirst({ where: { id: classId, archivedAt: null }, select: { clubId: true } });
  if (!course || !(await apiSites()).some((s) => s.id === course.clubId)) return null;
  return course.clubId;
}
