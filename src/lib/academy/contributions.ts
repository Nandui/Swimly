import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerCommitments, registerHomeCard, type HomeItem } from "@/modules/contributions";

/** What the Academy tells other modules (docs/academy.md).
 *
 *  Commitments: each session of a course that is not cancelled, once for its tutor and once for
 *  its assessor when that is someone else, so the Rota shows the session in its area, counts the
 *  time in their shift and warns about double bookings. The Rota never reads Academy tables. */
export const ACADEMY_SESSIONS = "academy.sessions";

registerCommitments({
  id: ACADEMY_SESSIONS,
  async list(query) {
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
        source: ACADEMY_SESSIONS, userId, siteId: s.course.siteId, date: s.date.toISOString().slice(0, 10), startMinutes: s.startMinutes, endMinutes: s.endMinutes,
        label: s.place ? `${title}, ${s.place}` : title, title, place: s.place, href: `/academy/${s.course.id}`, ref: s.id,
      }));
    });
  },
});

/** The Academy on the home page: registers to take today on the courses they tutor, and
 *  courses starting in the next fortnight at their sites. */
registerHomeCard({
  moduleId: "academy",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("academy.read")) return [];
    const on = today();
    const soon = new Date(`${on}T00:00:00Z`); soon.setUTCDate(soon.getUTCDate() + 14);
    const sites = await sitesFor("academy.read");
    const inSites = sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } };
    const [registers, starting] = await Promise.all([
      held.has("academy.run") ? prisma.academySession.count({ where: { date: parseDateOnly(on), registerAt: null, course: { cancelledAt: null, OR: [{ tutorId: viewer.id }, { assessorId: viewer.id }] } } }) : 0,
      prisma.academyCourse.count({ where: { ...inSites, cancelledAt: null, status: "planned", sessions: { some: { date: { gte: parseDateOnly(on), lte: soon } } }, NOT: { sessions: { some: { date: { lt: parseDateOnly(on) } } } } } }),
    ]);
    const items: HomeItem[] = [];
    if (registers) items.push({ label: "Academy registers to take today", href: "/academy", count: registers, attention: true });
    if (starting) items.push({ label: "Academy courses starting in the next two weeks", href: "/academy", count: starting });
    return items;
  },
});
