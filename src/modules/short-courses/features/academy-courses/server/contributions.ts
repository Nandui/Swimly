import "server-only";
import { formatDate, parseDateOnly, toDateOnlyString, today } from "@/lib/format";
import { sitesByIds } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import type { Commitment, CommitmentQuery, HomeItem, HomeViewer, MemberHistoryEntry } from "@/modules/contributions";
import { ACADEMY_RESULT_META } from "@/modules/short-courses/shared/academy-rules";

/** What the Academy tells other modules (docs/academy.md).
 *
 *  Commitments: each session of a course that is not cancelled, once for its tutor and once for
 *  its assessor when that is someone else, so the Rota shows the session in its area, counts the
 *  time in their shift and warns about double bookings. The Rota never reads Academy tables.
 *  Both are registered in module.ts. */
export const ACADEMY_SESSIONS = "academy.sessions";

export async function academySessionCommitments(query: CommitmentQuery): Promise<Commitment[]> {
  const rows = await prisma.academySession.findMany({
    where: {
      date: { gte: parseDateOnly(query.from), lte: parseDateOnly(query.to) },
      course: {
        cancelledAt: null,
        ...(query.siteIds ? { siteId: { in: [...query.siteIds] } } : {}),
        ...(query.userIds ? { OR: [{ tutorId: { in: [...query.userIds] } }, { assessorId: { in: [...query.userIds] } }] } : {}),
      },
    },
    select: { id: true, date: true, startMinutes: true, endMinutes: true, place: true,
      course: { select: { id: true, siteId: true, tutorId: true, assessorId: true, type: { select: { name: true } } } } },
  });
  return rows.flatMap((s) => {
    const people = [s.course.tutorId, ...(s.course.assessorId && s.course.assessorId !== s.course.tutorId ? [s.course.assessorId] : [])]
      .filter((u) => !query.userIds || query.userIds.includes(u));
    const title = `${s.course.type.name} course`;
    return people.map((userId) => ({
      source: ACADEMY_SESSIONS, module: "Academy", userId, siteId: s.course.siteId, date: s.date.toISOString().slice(0, 10), startMinutes: s.startMinutes, endMinutes: s.endMinutes,
      label: s.place ? `${title}, ${s.place}` : title, title, place: s.place, href: `/short-courses/academy/${s.course.id}`, ref: s.id,
    }));
  });
}

/** The Academy on the home page: people who held a place online to phone for payment (every
 *  level; flagged when any are past their 72 hours), registers to take today on the courses they
 *  tutor, and courses starting in the next fortnight at their sites. */
export async function academyHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("academy.read")) return [];
  const on = today();
  const soon = new Date(`${on}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 14);
  const sites = await sitesFor("academy.read");
  const inSites = sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } };
  const owing = { source: "online", payment: "owed", status: "booked", course: { cancelledAt: null, status: { not: "completed" }, ...inSites } };
  const [toCall, overdue, registers, starting] = await Promise.all([
    prisma.academyCandidate.count({ where: owing }),
    prisma.academyCandidate.count({ where: { ...owing, callBy: { lt: new Date() } } }),
    held.has("academy.run") ? prisma.academySession.count({ where: { date: parseDateOnly(on), registerAt: null, course: { cancelledAt: null, OR: [{ tutorId: viewer.id }, { assessorId: viewer.id }] } } }) : 0,
    prisma.academyCourse.count({ where: { ...inSites, cancelledAt: null, status: "planned", sessions: { some: { date: { gte: parseDateOnly(on), lte: soon } } }, NOT: { sessions: { some: { date: { lt: parseDateOnly(on) } } } } } }),
  ]);
  const items: HomeItem[] = [];
  if (toCall) items.push({ label: "Academy: to call for payment", hint: overdue ? `${overdue} past 72 hours` : "Held a place online", href: "/short-courses/academy/calls", count: toCall, attention: overdue > 0 });
  if (registers) items.push({ label: "Academy registers to take today", href: "/short-courses/academy", count: registers, attention: true });
  if (starting) items.push({ label: "Academy courses starting in the next two weeks", href: "/short-courses/academy", count: starting });
  return items;
}

/** Member history (owner request, 21 October 2026): the Academy courses a member of the public has
 *  been on, for their swimmer profile. Course, site, dates and the result only. */
export async function academyMemberHistory(swimmerId: string): Promise<MemberHistoryEntry[]> {
  const rows = await prisma.academyCandidate.findMany({
    where: { swimmerId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, status: true, course: { select: { siteId: true, cancelledAt: true, type: { select: { name: true } },
      sessions: { orderBy: { date: "asc" }, select: { date: true } } } } },
  });
  const sites = await sitesByIds(rows.map((r) => r.course.siteId));
  return rows.map((r) => {
    const first = r.course.sessions[0]?.date, last = r.course.sessions[r.course.sessions.length - 1]?.date;
    const span = first ? (last && last.getTime() !== first.getTime() ? `${formatDate(first)} to ${formatDate(last)}` : formatDate(first)) : "No sessions";
    const result = r.course.cancelledAt ? "course cancelled" : (ACADEMY_RESULT_META[r.status as keyof typeof ACADEMY_RESULT_META]?.label ?? r.status).toLowerCase();
    return { id: `ac-${r.id}`, title: `${r.course.type.name} at ${sites.get(r.course.siteId)?.name ?? "a closed site"}`, detail: `${span} · ${result}`, on: first ? toDateOnlyString(first) : "", module: "Academy" };
  });
}
