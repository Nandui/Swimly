import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { areaNames } from "@/lib/setup/data";
import { requireAcademyActor } from "@/modules/academy/shared/access";
import { courseState, readiness, takesPlace } from "@/modules/academy/shared/rules";

/** The Academy's reads (docs/academy.md). Courses are limited to the sites `academy.read`
 *  covers; a course outside them is a 404. The course list belongs to the organisation. */

import { inSites, iso } from "@/modules/academy/shared/reads";

const COURSE_ROW = {
  id: true, status: true, capacity: true, priceCents: true, cancelledAt: true, siteId: true,
  site: { select: { name: true } }, tutor: { select: { name: true } },
  type: { select: { name: true, kind: true } },
  sessions: { orderBy: [{ date: "asc" as const }, { startMinutes: "asc" as const }], select: { date: true, startMinutes: true, endMinutes: true } },
  candidates: { select: { status: true } },
} satisfies Prisma.AcademyCourseSelect;

function rowOf(c: {
  id: string; status: string; capacity: number; priceCents: number; cancelledAt: Date | null; siteId: string;
  site: { name: string }; tutor: { name: string }; type: { name: string; kind: string };
  sessions: { date: Date; startMinutes: number; endMinutes: number }[]; candidates: { status: string }[];
}, on: string) {
  const first = c.sessions[0] ? iso(c.sessions[0].date) : null;
  const last = c.sessions.length ? iso(c.sessions[c.sessions.length - 1].date) : null;
  return {
    id: c.id, name: c.type.name, kind: c.type.kind, site: c.site.name, siteId: c.siteId, tutor: c.tutor.name, capacity: c.capacity,
    taken: c.candidates.filter((x) => takesPlace(x.status)).length, sessions: c.sessions.length, first, last,
    hours: c.sessions.reduce((n, s) => n + s.endMinutes - s.startMinutes, 0),
    state: courseState(c, first, on),
  };
}
export type CourseRow = ReturnType<typeof rowOf>;

/** The first page: courses coming up and running, and those finished in the last 90 days. */
export async function academyHome() {
  const who = await requireAcademyActor();
  const sites = await sitesFor("academy.read");
  const on = today();
  const rows = await prisma.academyCourse.findMany({ where: { orgId: who.orgId ?? undefined, ...inSites(sites) }, orderBy: { createdAt: "desc" }, take: 200, select: COURSE_ROW });
  const courses = rows.map((c) => rowOf(c, on));
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const byStart = (a: CourseRow, b: CourseRow) => (a.first ?? "9999").localeCompare(b.first ?? "9999");
  return {
    who,
    current: courses.filter((c) => c.state === "planned" || c.state === "running").sort(byStart),
    past: courses.filter((c) => (c.state === "completed" || c.state === "cancelled") && (c.last ?? "") >= since).sort((a, b) => byStart(b, a)),
    types: await prisma.academyCourseType.count({ where: { orgId: who.orgId ?? undefined, archivedAt: null } }),
  };
}

/** Staff who can tutor or take a course at a site: active, working there. */
function staffAt(orgId: string | undefined, siteId: string) {
  return prisma.user.findMany({
    where: { orgId, isActive: true, OR: [{ siteIds: { has: siteId } }, { siteIds: { isEmpty: true } }] },
    orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true },
  });
}

/** What a new course needs: the sites this person may put courses on, and the course list. */
export async function newCourseOptions() {
  const who = await requireAcademyActor();
  const sites = await sitesFor("academy.manage");
  const [siteRows, types] = await Promise.all([
    prisma.club.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null, ...(sites.kind === "all" ? {} : { id: { in: [...sites.siteIds] } }) }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    prisma.academyCourseType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const staff = await Promise.all(siteRows.map(async (s) => ({ siteId: s.id, people: await staffAt(who.orgId ?? undefined, s.id) })));
  return { who, sites: siteRows, types, staff };
}

/** One course with its sessions and register, candidates and where each stands, and what this
 *  person may do with it. */
export async function academyCourse(id: string) {
  const who = await requireAcademyActor();
  const course = await prisma.academyCourse.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      id: true, status: true, capacity: true, priceCents: true, note: true, bookOnline: true, cancelledAt: true, siteId: true, tutorId: true, assessorId: true, typeId: true,
      createdByName: true, createdAt: true,
      site: { select: { name: true } }, tutor: { select: { name: true } }, assessor: { select: { name: true } },
      type: { select: { name: true, kind: true, awardingBody: true, minAge: true, minHours: true, checks: true, qualificationType: { select: { name: true, validityMonths: true } } } },
      sessions: { orderBy: [{ date: "asc" }, { startMinutes: "asc" }], select: { id: true, date: true, startMinutes: true, endMinutes: true, place: true, note: true, registerAt: true, registerBy: true,
        attendance: { select: { candidateId: true, minutes: true } } } },
      candidates: { orderBy: [{ status: "asc" }, { name: "asc" }], select: {
        id: true, userId: true, name: true, email: true, phone: true, dateOfBirth: true, payment: true, paidCents: true, status: true,
        swimTestOn: true, medicalOn: true, idCheckedOn: true, checkedByName: true, resultOn: true, resultNote: true, certificateNumber: true, certificateExpires: true,
        qualificationId: true, note: true, source: true, reference: true, phone2: true, callTimes: true, callBy: true, createdAt: true,
        calls: { orderBy: { createdAt: "desc" }, select: { outcome: true, note: true, byName: true, createdAt: true } } } },
    },
  });
  if (!course) notFound();
  const resource = { siteId: course.siteId, orgId: who.orgId };
  const [read, run, manage] = await Promise.all([mayFor("academy.read", resource), mayFor("academy.run", resource), mayFor("academy.manage", resource)]);
  if (!read) notFound();
  const on = today();
  const first = course.sessions[0] ? iso(course.sessions[0].date) : null;
  const dateOf = (d: Date | null) => (d ? iso(d) : null);
  const candidates = course.candidates.map((c) => {
    const attended = course.sessions.reduce((n, s) => n + (s.attendance.find((a) => a.candidateId === c.id)?.minutes ?? 0), 0);
    const cand = { ...c, dateOfBirth: dateOf(c.dateOfBirth), swimTestOn: dateOf(c.swimTestOn), medicalOn: dateOf(c.medicalOn), idCheckedOn: dateOf(c.idCheckedOn),
      resultOn: dateOf(c.resultOn), certificateExpires: dateOf(c.certificateExpires) };
    return { ...cand, attended, readiness: readiness(course.type, cand, first, attended) };
  });
  const [areas, staff] = await Promise.all([areaNames(course.siteId), run ? staffAt(who.orgId ?? undefined, course.siteId) : []]);
  return {
    who, canRun: run, canManage: manage, areas, staff, today: on,
    course: {
      ...course, state: courseState(course, first, on), first,
      last: course.sessions.length ? iso(course.sessions[course.sessions.length - 1].date) : null,
      hours: course.sessions.reduce((n, s) => n + s.endMinutes - s.startMinutes, 0),
      taken: candidates.filter((c) => takesPlace(c.status)).length,
      sessions: course.sessions.map((s) => ({ ...s, date: iso(s.date) })),
    },
    candidates,
  };
}
export type AcademyCourseView = Awaited<ReturnType<typeof academyCourse>>;
