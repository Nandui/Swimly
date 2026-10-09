import "server-only";
import { withSites } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requireAcademyActor } from "@/modules/academy/shared/access";
import { callDue } from "@/modules/academy/shared/rules";

/** The Academy's reads (docs/academy.md). Courses are limited to the sites `academy.read`
 *  covers; a course outside them is a 404. The course list belongs to the organisation. */

import { inSites, iso } from "@/modules/academy/shared/reads";

/** Who to phone for payment: everyone who held a place online and still owes, on courses that are
 *  on, at the sites `academy.read` covers; soonest deadline first (owner decision, 8 October 2026:
 *  every Academy level sees and works this list). */
export async function toCall(now: Date = new Date()) {
  const who = await requireAcademyActor();
  const sites = await sitesFor("academy.read");
  const rows = await prisma.academyCandidate.findMany({
    where: { source: "online", payment: "owed", status: "booked", course: { orgId: who.orgId ?? undefined, cancelledAt: null, status: { not: "completed" }, ...inSites(sites) } },
    orderBy: [{ callBy: "asc" }, { createdAt: "asc" }], take: 300,
    select: {
      id: true, name: true, email: true, phone: true, phone2: true, callTimes: true, callBy: true, createdAt: true, reference: true, note: true,
      calls: { orderBy: { createdAt: "desc" }, select: { outcome: true, note: true, byName: true, createdAt: true } },
      course: { select: { id: true, priceCents: true, siteId: true, type: { select: { name: true } },
        sessions: { orderBy: [{ date: "asc" }, { startMinutes: "asc" }], take: 1, select: { date: true, startMinutes: true } } } },
    },
  });
  const courses = new Map((await withSites(rows.map((r) => r.course), "siteId", "site")).map((c) => [c.id, c]));
  const people = rows.map((r) => ({ ...r, course: courses.get(r.course.id)! })).map((r) => ({ ...r, ...callDue(r.callBy ?? r.createdAt, now), first: r.course.sessions[0] ? iso(r.course.sessions[0].date) : null }));
  return { who, people, overdue: people.filter((p) => p.due === "overdue").length, soon: people.filter((p) => p.due === "soon").length };
}
export type ToCall = Awaited<ReturnType<typeof toCall>>["people"][number];
