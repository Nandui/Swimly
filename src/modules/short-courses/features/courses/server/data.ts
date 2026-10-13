import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { activeStaffAtSite, liveSitesOf, withSites, withStaff } from "@/lib/directory";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { areaNames } from "@/lib/setup/data";
import { requireShortCoursesActor } from "@/modules/short-courses/shared/access";
import { inSites, iso } from "@/modules/short-courses/shared/reads";
import { courseState, stillOwed, takesPlace, waitingOrder } from "@/modules/short-courses/shared/rules";

/** The reads (docs/short-courses.md). Courses are limited to the sites `short-courses.read`
 *  covers; a course outside them is a 404. The course list belongs to the organisation. */

const COURSE_ROW = {
  id: true, status: true, capacity: true, priceCents: true, cancelledAt: true, siteId: true, instructorId: true,
  type: { select: { name: true, area: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true } },
  participants: { select: { status: true } },
} satisfies Prisma.ShortCourseSelect;

/** Adds each course's site and its instructor from Core. A removed account still reads as a name. */
async function withPeople<T extends { siteId: string; instructorId: string }>(rows: T[]) {
  const all = await withStaff(await withSites(rows, "siteId", "site"), "instructorId", "instructor");
  return all.map((row) => ({ ...row, instructor: row.instructor ?? { id: row.instructorId, name: "Removed account" } }));
}

function rowOf(c: {
  id: string; status: string; capacity: number; priceCents: number; cancelledAt: Date | null; siteId: string;
  site: { name: string }; instructor: { name: string }; type: { name: string; area: string };
  sessions: { date: Date; startMinutes: number; endMinutes: number }[]; participants: { status: string }[];
}, on: string) {
  const first = c.sessions[0] ? iso(c.sessions[0].date) : null;
  const last = c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null;
  const next = c.sessions.find((s) => iso(s.date) >= on) ?? null;
  return {
    id: c.id, name: c.type.name, area: c.type.area, site: c.site.name, siteId: c.siteId, instructor: c.instructor.name, capacity: c.capacity,
    taken: c.participants.filter((p) => takesPlace(p.status)).length, waiting: c.participants.filter((p) => p.status === "waiting").length,
    sessions: c.sessions.length, first, last, next: next && { date: iso(next.date), startMinutes: next.startMinutes, endMinutes: next.endMinutes },
    state: courseState(c, first, on),
  };
}
export type CourseRow = ReturnType<typeof rowOf>;

/** The courses page: coming up and running, and those finished in the last 90 days. */
export async function shortCoursesHome() {
  const who = await requireShortCoursesActor();
  const sites = await sitesFor("short-courses.read");
  const on = today();
  const rows = await withPeople(await prisma.shortCourse.findMany({ where: { orgId: who.orgId ?? undefined, ...inSites(sites) }, orderBy: { createdAt: "desc" }, take: 300, select: COURSE_ROW }));
  const courses = rows.map((c) => rowOf(c, on));
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const byStart = (a: CourseRow, b: CourseRow) => (a.first ?? "9999").localeCompare(b.first ?? "9999");
  return {
    who,
    current: courses.filter((c) => c.state === "planned" || c.state === "running").sort(byStart),
    past: courses.filter((c) => (c.state === "finished" || c.state === "cancelled") && (c.last ?? "") >= since).sort((a, b) => byStart(b, a)),
    types: await prisma.shortCourseType.count({ where: { orgId: who.orgId ?? undefined, archivedAt: null } }),
  };
}

/** What a new course needs: the sites this person may put courses on, with their areas and
 *  staff, and the course list with each one's weeks and session length. */
export async function newCourseOptions() {
  const who = await requireShortCoursesActor();
  const sites = await sitesFor("short-courses.manage");
  const [siteRows, types] = await Promise.all([
    liveSitesOf(who.orgId ?? null).then((rows) => rows.filter((s) => sites.kind === "all" || sites.siteIds.has(s.id)).map(({ id, name }) => ({ id, name }))),
    prisma.shortCourseType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, weeks: true, sessionMinutes: true } }),
  ]);
  const perSite = await Promise.all(siteRows.map(async (s) => ({ siteId: s.id, people: await activeStaffAtSite(who.orgId ?? null, s.id), areas: await areaNames(s.id) })));
  return { who, sites: siteRows, types, perSite, today: today() };
}

/** One course: its sessions and registers, who is booked and who is waiting, and what this
 *  person may do with it. */
export async function shortCourse(id: string) {
  const who = await requireShortCoursesActor();
  const row = await prisma.shortCourse.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      id: true, status: true, capacity: true, priceCents: true, note: true, cancelledAt: true, siteId: true, instructorId: true, typeId: true, createdByName: true, createdAt: true,
      type: { select: { name: true, area: true, description: true, minAge: true, healthForm: true } },
      sessions: { orderBy: [{ date: "asc" }, { startMinutes: "asc" }], select: { id: true, date: true, startMinutes: true, endMinutes: true, place: true, note: true, registerAt: true, registerBy: true,
        attendance: { select: { participantId: true, present: true } } } },
      participants: { orderBy: [{ createdAt: "asc" }], select: {
        id: true, name: true, email: true, phone: true, dateOfBirth: true, status: true, payment: true, paidCents: true, healthFormOn: true, note: true, createdAt: true } },
    },
  });
  if (!row) notFound();
  const [course] = await withPeople([row]);
  const resource = { siteId: course.siteId, orgId: who.orgId };
  const [read, run, manage] = await Promise.all([mayFor("short-courses.read", resource), mayFor("short-courses.run", resource), mayFor("short-courses.manage", resource)]);
  if (!read) notFound();
  const on = today();
  const first = course.sessions[0] ? iso(course.sessions[0].date) : null;
  const held = course.sessions.filter((s) => iso(s.date) <= on).length;
  const person = (p: (typeof course.participants)[number]) => ({
    ...p, dateOfBirth: p.dateOfBirth ? iso(p.dateOfBirth) : null, healthFormOn: p.healthFormOn ? iso(p.healthFormOn) : null,
    attended: course.sessions.filter((s) => s.attendance.some((a) => a.participantId === p.id && a.present)).length,
    owed: stillOwed(course.priceCents, p),
  });
  const [areas, staff] = await Promise.all([areaNames(course.siteId), manage ? activeStaffAtSite(who.orgId ?? null, course.siteId) : []]);
  const booked = course.participants.filter((p) => takesPlace(p.status)).map(person);
  return {
    who, canRun: run, canManage: manage, areas, staff, today: on,
    course: {
      ...course, state: courseState(course, first, on), first, held,
      last: course.sessions.length ? iso(course.sessions[course.sessions.length - 1].date) : null,
      taken: booked.length,
      sessions: course.sessions.map((s) => ({ ...s, date: iso(s.date) })),
    },
    booked,
    waiting: waitingOrder(course.participants).map(person),
    withdrawn: course.participants.filter((p) => p.status === "withdrawn").map(person),
  };
}
export type ShortCourseView = Awaited<ReturnType<typeof shortCourse>>;
