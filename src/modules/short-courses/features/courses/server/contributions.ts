import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { parseDateOnly, today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { AreaRename, Commitment, CommitmentQuery, HomeItem, HomeViewer } from "@/modules/contributions";

/** What Short courses tells other modules (docs/short-courses.md), registered in module.ts.
 *
 *  Commitments: each session of a course that is not cancelled, for its instructor, so the Rota
 *  shows it in its area, counts the time in their shift and warns about double bookings. The
 *  Rota never reads these tables. */
export const SHORT_COURSE_SESSIONS = "short-courses.sessions";

export async function shortCourseCommitments(query: CommitmentQuery): Promise<Commitment[]> {
  const rows = await prisma.shortCourseSession.findMany({
    where: {
      date: { gte: parseDateOnly(query.from), lte: parseDateOnly(query.to) },
      course: {
        cancelledAt: null,
        ...(query.siteIds ? { siteId: { in: [...query.siteIds] } } : {}),
        ...(query.userIds ? { instructorId: { in: [...query.userIds] } } : {}),
      },
    },
    select: { id: true, date: true, startMinutes: true, endMinutes: true, place: true, course: { select: { id: true, siteId: true, instructorId: true, type: { select: { name: true } } } } },
  });
  return rows.map((s) => ({
    source: SHORT_COURSE_SESSIONS, module: "Short courses", userId: s.course.instructorId, siteId: s.course.siteId, date: s.date.toISOString().slice(0, 10),
    startMinutes: s.startMinutes, endMinutes: s.endMinutes, title: s.course.type.name, place: s.place,
    label: s.place ? `${s.course.type.name}, ${s.place}` : s.course.type.name, href: `/short-courses/${s.course.id}`, ref: s.id,
  }));
}

/** When Admin renames one of a site's areas, the sessions there follow. */
export async function renameShortCoursePlaces({ siteId, from, to }: AreaRename, tx?: unknown) {
  const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
  const moved = await db.shortCourseSession.updateMany({ where: { place: { equals: from, mode: "insensitive" }, course: { siteId } }, data: { place: to } });
  return moved.count;
}

/** Short courses on the home page: registers to take today on the courses someone instructs,
 *  waiting lists with a place free, and courses starting in the next fortnight at their sites. */
export async function shortCourseHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("short-courses.read")) return [];
  const on = today();
  const soon = new Date(`${on}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 14);
  const sites = await sitesFor("short-courses.read");
  const inSites = sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } };
  const [registers, starting, open] = await Promise.all([
    held.has("short-courses.run") ? prisma.shortCourseSession.count({ where: { date: parseDateOnly(on), registerAt: null, course: { cancelledAt: null, instructorId: viewer.id } } }) : 0,
    prisma.shortCourse.count({ where: { ...inSites, cancelledAt: null, status: "planned", sessions: { some: { date: { gte: parseDateOnly(on), lte: soon } } }, NOT: { sessions: { some: { date: { lt: parseDateOnly(on) } } } } } }),
    prisma.shortCourse.findMany({ where: { ...inSites, cancelledAt: null, status: "planned", participants: { some: { status: "waiting" } } },
      select: { capacity: true, _count: { select: { participants: { where: { status: "booked" } } } } } }),
  ]);
  const freeForWaiting = open.filter((c) => c._count.participants < c.capacity).length;
  const items: HomeItem[] = [];
  if (registers) items.push({ label: "Short course registers to take today", href: "/short-courses", count: registers, attention: true });
  if (freeForWaiting) items.push({ label: "Short courses with a place for the waiting list", hint: "Offer it to the first person waiting", href: "/short-courses", count: freeForWaiting, attention: true });
  if (starting) items.push({ label: "Short courses starting in the next two weeks", href: "/short-courses", count: starting });
  return items;
}
