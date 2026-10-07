import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";
import { registerAreaRename, registerCommitments, registerHomeCard, registerSiteSummary, registerStaffColumn, type Commitment, type HomeIcon, type HomeItem, type HomeSession } from "@/modules/contributions";
import { formatTime, isDateOnly, minutesNow, parseDateOnly, plural, today } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { staffByIds } from "@/lib/directory";
import { weekdayOfIso } from "@/modules/activities/lib/attendance/dates";
import { getCoversForDay } from "@/modules/activities/lib/attendance/data/cover";
import { getCancellationsForDay } from "@/modules/activities/lib/cancellations/data";
import { courseName } from "@/modules/activities/lib/courses/constants";
import { getCoursesOnDate } from "@/modules/activities/lib/courses/planned";
import { getAwaitingEnrolment } from "@/modules/activities/lib/enrolment/data/awaiting-enrolment";
import { getTodayAssessments } from "@/modules/activities/lib/today/assessments";
import { sessionState } from "@/modules/activities/lib/today/calendar";


/** Classes each person is the scheduled instructor for, archived ones included,
 *  as the Staff page has always counted them. */
registerStaffColumn({
  id: "activities.classes",
  header: "Classes",
  async values(userIds) {
    if (userIds.length === 0) return new Map();
    const rows = await prisma.course.groupBy({ by: ["instructorId"], where: { instructorId: { in: userIds } }, _count: { _all: true } });
    return new Map(rows.filter((row) => row.instructorId).map((row) => [row.instructorId!, String(row._count._all)]));
  },
});

/** Who teaches which class when, for the rota's plan and its clash check: each class on each
 *  date in the range, taught by that day's cover (it has started), else the teacher planned for
 *  that date on the rota, else its instructor; cancelled sessions left out. Times and labels only.
 *  The rota plans a date's teacher through `plan` (owner decision, 6 October 2026). */
registerCommitments({
  id: "activities.classes",
  async list({ siteIds, userIds, from, to }) {
    const dates: string[] = [];
    for (let d = from; d <= to && dates.length < 62; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) dates.push(d);
    if (dates.length === 0) return [];
    const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
    const courses = await prisma.course.findMany({
      where: {
        archivedAt: null, dayOfWeek: { in: [...new Set(dates.map(weekdayOfIso))] },
        ...(siteIds ? { clubId: { in: [...siteIds] } } : {}),
        ...(userIds ? { OR: [{ instructorId: { in: [...userIds] } }, { covers: { some: { date: range, coverById: { in: [...userIds] } } } },
          { plannedTeachers: { some: { date: range, teacherId: { in: [...userIds] } } } }] } : {}),
      },
      select: { id: true, clubId: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, instructorId: true, name: true, location: true, level: { select: { name: true } } },
    });
    if (courses.length === 0) return [];
    const ids = courses.map((c) => c.id);
    const [covers, planned, cancelled] = await Promise.all([
      prisma.classCover.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true, coverById: true } }),
      prisma.classPlannedTeacher.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true, teacherId: true } }),
      prisma.classCancellation.findMany({ where: { courseId: { in: ids }, date: range }, select: { courseId: true, date: true } }),
    ]);
    const key = (courseId: string, date: Date) => `${courseId}|${date.toISOString().slice(0, 10)}`;
    const coverBy = new Map(covers.map((c) => [key(c.courseId, c.date), c.coverById]));
    const plannedBy = new Map(planned.map((p) => [key(p.courseId, p.date), p.teacherId]));
    const off = new Set(cancelled.map((c) => key(c.courseId, c.date)));
    const out: Commitment[] = [];
    for (const date of dates) {
      const weekday = weekdayOfIso(date);
      for (const c of courses) {
        const k = `${c.id}|${date}`;
        if (c.dayOfWeek !== weekday || off.has(k)) continue;
        const userId = coverBy.has(k) ? coverBy.get(k) ?? null : plannedBy.has(k) ? plannedBy.get(k) ?? null : c.instructorId;
        if (userIds && (!userId || !userIds.includes(userId))) continue;
        out.push({ source: "activities.classes", userId, siteId: c.clubId, date, startMinutes: c.startMinutes, endMinutes: c.startMinutes + c.durationMinutes,
          label: [courseName(c), c.location].filter(Boolean).join(", "), href: `/schedule?date=${date}`, ref: c.id, planned: !coverBy.has(k) && plannedBy.has(k),
          place: c.location ?? undefined, title: courseName(c) });
      }
    }
    return out;
  },
  /** Plan who teaches a class on a date. Planning its usual instructor clears the plan. The
   *  class's start record (ClassCover) is never written here: it is made when the class starts. */
  async plan({ ref, siteId, date, userId, by }) {
    if (!isDateOnly(date)) return { ok: false, error: "Choose a date." };
    const course = await prisma.course.findFirst({ where: { id: ref, clubId: siteId, archivedAt: null }, select: { id: true, dayOfWeek: true, instructorId: true, name: true, level: { select: { name: true } } } });
    if (!course) return { ok: false, error: "That class is no longer on the timetable." };
    if (weekdayOfIso(date) !== course.dayOfWeek) return { ok: false, error: "That class does not run on that day." };
    const on = parseDateOnly(date);
    if (await prisma.classCancellation.findFirst({ where: { courseId: ref, date: on }, select: { id: true } })) return { ok: false, error: "That class is cancelled that day." };
    if (await prisma.classCover.findFirst({ where: { courseId: ref, date: on }, select: { id: true } })) return { ok: false, error: "That class has already started; its teacher is recorded on the register." };
    const teacher = userId ? (await staffByIds([userId])).get(userId) : null;
    if (userId && !teacher) return { ok: false, error: "That person is no longer active." };
    const label = `${courseName(course)} on ${date}`;
    await prisma.$transaction(async (tx) => {
      if (userId === course.instructorId) await tx.classPlannedTeacher.deleteMany({ where: { courseId: ref, date: on } });
      else await tx.classPlannedTeacher.upsert({
        where: { courseId_date: { courseId: ref, date: on } },
        create: { courseId: ref, date: on, teacherId: userId, teacherName: teacher?.name ?? null, setById: by.id, setByName: by.name },
        update: { teacherId: userId, teacherName: teacher?.name ?? null, setById: by.id, setByName: by.name },
      });
      await logAudit({ actorId: by.id, actorName: by.name, action: "update", entity: "ClassPlannedTeacher", entityId: ref, clubId: siteId,
        summary: userId === course.instructorId ? `Planned ${label} with its usual instructor` : `Planned ${label} with ${teacher?.name ?? "nobody yet"}` }, tx);
    });
    return { ok: true };
  },
});

/** What each site runs in Aquatics: live programmes, active swimmers and live classes. */
registerSiteSummary({
  id: "activities.site",
  async lines(clubIds) {
    if (clubIds.length === 0) return new Map();
    const [programmes, students, courses] = await Promise.all([
      prisma.programme.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
      prisma.student.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, status: "ACTIVE" }, _count: { _all: true } }),
      prisma.course.groupBy({ by: ["clubId"], where: { clubId: { in: clubIds }, archivedAt: null }, _count: { _all: true } }),
    ]);
    const count = (rows: { clubId: string; _count: { _all: number } }[], id: string) => rows.find((row) => row.clubId === id)?._count._all ?? 0;
    return new Map(clubIds.map((id) => [id, [
      plural(count(programmes, id), "programme", "programmes"),
      plural(count(students, id), "active swimmer", "active swimmers"),
      plural(count(courses, id), "class", "classes"),
    ].join(" · ")]));
  },
});

/** The Swim school on the home page, for the viewer's working site. Quick
 *  actions for the desk's everyday jobs, today's classes and assessments, and
 *  the follow-up queues with their counts. Each thing appears only when the
 *  viewer can already open it. Finding a swimmer is the frame's search. */
type SwimAction = { label: string; href: string; icon: HomeIcon; screen: ScreenKey; permission?: PermissionKey };
const SWIM_ACTIONS: readonly SwimAction[] = [
  { icon: "userPlus", label: "Add a swimmer", href: "/students?add=1", screen: "students", permission: "students.manage" },
  { icon: "calendarPlus", label: "Book an assessment", href: "/assessments", screen: "assessments", permission: "enrolment.manage" },
];

registerHomeCard({
  moduleId: "swim-school",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const screens = visibleScreens(held);
    const allowed = (line: SwimAction) => screens.has(line.screen) && (!line.permission || held.has(line.permission));
    const strip = ({ label, href, icon }: SwimAction): HomeItem => ({ kind: "action", label, href, icon });
    const iso = today();
    const [classes, cancelled, assessments, covers, awaiting, parentUpdates] = await Promise.all([
      screens.has("calendar") ? getCoursesOnDate(iso) : null,
      screens.has("calendar") ? getCancellationsForDay(iso) : null,
      screens.has("calendar") ? getTodayAssessments(iso) : null,
      screens.has("calendar") ? getCoversForDay(iso) : null,
      screens.has("awaiting-enrolment") ? getAwaitingEnrolment() : null,
      screens.has("students") && held.has("students.manage") ? prisma.parentChangeRequest.count({ where: { status: "PENDING" } }) : null,
    ]);
    const items: HomeItem[] = SWIM_ACTIONS.filter(allowed).map(strip);
    if (classes && cancelled) {
      const off = classes.filter((c) => cancelled.has(c.id)).length;
      items.push({ kind: "today", label: classes.length - off === 1 ? "Class" : "Classes", count: classes.length - off, hint: off ? `${plural(off, "class", "classes")} cancelled` : "None cancelled", href: "/schedule" });
    }
    if (classes && cancelled && assessments && covers) {
      const now = minutesNow();
      const sessions: HomeSession[] = [
        ...classes.map((c): HomeSession => {
          const end = c.startMinutes + c.durationMinutes, cover = covers.get(c.id);
          const who = cover?.coverByName ?? c.instructor?.name ?? null;
          return {
            label: courseName(c), area: c.location || "Pool area not set", start: c.startMinutes, end, hint: who ?? "No instructor", href: `/courses/${c.id}`,
            state: sessionState({ ...c, cancellation: cancelled.get(c.id) ?? null, instructor: who }, now),
          };
        }),
        ...assessments.map((a): HomeSession => ({
          label: a.typeName ?? `${a.programmeName} assessment`, area: a.location || "Pool area not set", start: a.startMinutes, end: a.startMinutes + a.durationMinutes,
          hint: `${a.booked} booked`, href: `/assessments/${a.id}`, state: "assessment",
        })),
      ];
      if (sessions.length) items.push({ kind: "timeline", label: "Classes today", href: "/schedule", sessions });
    }
    if (assessments) {
      const booked = assessments.reduce((sum, a) => sum + a.booked, 0);
      items.push({ kind: "today", icon: "clipboardCheck", label: assessments.length === 1 ? "Assessment" : "Assessments", count: assessments.length, hint: assessments.length ? `${plural(booked, "swimmer", "swimmers")} booked` : "No sessions today", href: "/schedule" });
    }
    if (awaiting) items.push({ label: "Awaiting enrolment", hint: "Class places and family follow-ups", href: "/awaiting-enrolment", count: awaiting.total, attention: awaiting.total > 0 });
    if (parentUpdates !== null) items.push({ label: "Parent updates", hint: "Contact and medical corrections", href: "/students/parent-changes", count: parentUpdates, attention: parentUpdates > 0 });
    return items;
  },
});

/** The Pool deck on the home page: the teacher's own classes today, what is
 *  next, and the way onto the deck. */
registerHomeCard({
  moduleId: "pool-deck",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    if (!visibleScreens(held).has("instructor")) return [];
    const iso = today(), now = minutesNow();
    const [courses, covers, cancelled] = await Promise.all([getCoursesOnDate(iso), getCoversForDay(iso), getCancellationsForDay(iso)]);
    const mine = courses.filter((c) => (c.instructorId === viewer.id || covers.get(c.id)?.coverById === viewer.id) && !cancelled.has(c.id));
    const ahead = mine.filter((c) => c.startMinutes + c.durationMinutes > now);
    return [
      {
        kind: "today", label: mine.length === 1 ? "Your class" : "Your classes", href: "/instructor", count: mine.length,
        hint: ahead.length ? `Next at ${formatTime(ahead[0].startMinutes)}` : mine.length ? "All done for today" : "Nothing on your list today",
      },
      { kind: "action", icon: "clipboardCheck", label: "Open my classes", href: "/instructor" },
    ];
  },
});

/** A site's area renamed in Admin: classes and assessment sessions at that site whose location
 *  is that area, or starts with it before a detail ("Learner pool, lane 3"), follow. */
registerAreaRename({
  id: "activities.locations",
  async rename({ siteId, from, to }, tx) {
    const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
    const where = { clubId: siteId, OR: [{ location: { equals: from, mode: "insensitive" as const } }, { location: { startsWith: `${from},`, mode: "insensitive" as const } }] };
    const renamed = (location: string | null) => `${to}${(location ?? "").slice(from.length)}`;
    const [courses, sessions] = await Promise.all([
      db.course.findMany({ where, select: { id: true, location: true } }),
      db.assessmentSession.findMany({ where, select: { id: true, location: true } }),
    ]);
    for (const c of courses) await db.course.update({ where: { id: c.id }, data: { location: renamed(c.location) } });
    for (const a of sessions) await db.assessmentSession.update({ where: { id: a.id }, data: { location: renamed(a.location) } });
    const changed = courses.length + sessions.length;
    return changed;
  },
});
