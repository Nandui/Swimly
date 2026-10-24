import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { formatDate, parseDateOnly, toDateOnlyString, today } from "@/lib/format";
import { sitesByIds } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { AreaRename, Commitment, CommitmentQuery, HomeItem, HomeViewer, MemberHistoryEntry } from "@/modules/contributions";
import { SHORT_COURSE_PLACE_META } from "@/modules/short-courses/shared/rules";

/** What Short courses tells other modules, registered in module.ts.
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

/** When Admin renames one of a site's areas, the sessions there follow, with any lanes they name
 *  after it ("Main pool, lane 3"). */
export async function renameShortCoursePlaces({ siteId, from, to }: AreaRename, tx?: unknown) {
  const db = (tx as Prisma.TransactionClient | undefined) ?? prisma;
  const moved = await db.shortCourseSession.updateMany({ where: { place: { equals: from, mode: "insensitive" }, course: { siteId } }, data: { place: to } });
  const withLanes = await db.shortCourseSession.findMany({ where: { place: { startsWith: `${from},`, mode: "insensitive" }, course: { siteId } }, select: { id: true, place: true } });
  for (const s of withLanes) await db.shortCourseSession.update({ where: { id: s.id }, data: { place: `${to}${s.place.slice(from.length)}` } });
  return moved.count + withLanes.length;
}

/** Short courses on the home page: registers to take today on the courses someone instructs,
 *  places booked online to phone about, waiting lists with a place free, and courses starting in the next fortnight at their sites. */
export async function shortCourseHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("short-courses.read")) return [];
  const on = today();
  const soon = new Date(`${on}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 14);
  const sites = await sitesFor("short-courses.read");
  const inSites = sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } };
  const [registers, starting, open, phone] = await Promise.all([
    held.has("short-courses.run") ? prisma.shortCourseSession.count({ where: { date: parseDateOnly(on), registerAt: null, course: { cancelledAt: null, instructorId: viewer.id } } }) : 0,
    prisma.shortCourse.count({ where: { ...inSites, cancelledAt: null, status: "planned", sessions: { some: { date: { gte: parseDateOnly(on), lte: soon } } }, NOT: { sessions: { some: { date: { lt: parseDateOnly(on) } } } } } }),
    prisma.shortCourse.findMany({ where: { ...inSites, cancelledAt: null, status: "planned", participants: { some: { status: "waiting" } } },
      select: { capacity: true, _count: { select: { participants: { where: { status: "booked" } } } } } }),
    prisma.shortCourseParticipant.findMany({ where: { source: "online", status: "booked", payment: "owed", callBy: { not: null }, course: { ...inSites, cancelledAt: null, status: "planned" } },
      select: { callBy: true } }),
  ]);
  const overdue = phone.filter((p) => p.callBy! <= new Date()).length;
  const freeForWaiting = open.filter((c) => c._count.participants < c.capacity).length;
  const items: HomeItem[] = [];
  if (phone.length) items.push({ label: "Short course places booked online to phone about", hint: overdue ? `${overdue} past 72 hours` : "Take payment within 72 hours", href: "/short-courses", count: phone.length, attention: true });
  if (registers) items.push({ label: "Short course registers to take today", href: "/short-courses", count: registers, attention: true });
  if (freeForWaiting) items.push({ label: "Short courses with a place for the waiting list", hint: "Offer it to the first person waiting", href: "/short-courses", count: freeForWaiting, attention: true });
  if (starting) items.push({ label: "Short courses starting in the next two weeks", href: "/short-courses", count: starting });
  return items;
}

/** Member history (owner request, 21 October 2026): the short courses a swimmer has been booked
 *  on or waited for, for their swimmer profile. Course, site, dates and where they stand only. */
export async function shortCourseMemberHistory(swimmerId: string): Promise<MemberHistoryEntry[]> {
  const rows = await prisma.shortCourseParticipant.findMany({
    where: { swimmerId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, status: true, course: { select: { siteId: true, cancelledAt: true, type: { select: { name: true } },
      sessions: { orderBy: { date: "asc" }, select: { date: true } } } } },
  });
  const sites = await sitesByIds(rows.map((r) => r.course.siteId));
  return rows.map((r) => {
    const dates = r.course.sessions.map((s) => toDateOnlyString(s.date));
    const span = dates.length ? (dates.length > 1 ? `${formatDate(r.course.sessions[0].date)} to ${formatDate(r.course.sessions[dates.length - 1].date)}` : formatDate(r.course.sessions[0].date)) : "No sessions";
    const place = r.course.cancelledAt ? "course cancelled" : (SHORT_COURSE_PLACE_META[r.status as keyof typeof SHORT_COURSE_PLACE_META]?.label ?? r.status).toLowerCase();
    return { id: `sc-${r.id}`, title: `${r.course.type.name} at ${sites.get(r.course.siteId)?.name ?? "a closed site"}`, detail: `${span} · ${place}`, on: dates[0] ?? "", module: "Short courses" };
  });
}
