import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { AuthorizationError } from "@/lib/authz";
import { absentOn, addDaysIso, mondayOf, shiftWarnings, type AbsenceReason } from "@/lib/rota/constants";

/** Rota reads. The sites a person may see come from the policy engine; a site
 *  outside them is a 404, never an empty rota. */

export async function rotaSites() {
  const who = await requireRotaActor();
  const [view, manage] = await Promise.all([sitesFor("rota.view"), who.manage ? sitesFor("rota.manage") : null]);
  const sites = await prisma.club.findMany({
    where: { archivedAt: null, orgId: who.orgId ?? undefined, ...(view.kind === "all" ? {} : { id: { in: [...view.siteIds] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const canManage = (siteId: string) => !!manage && (manage.kind === "all" || manage.siteIds.has(siteId));
  return { who, sites: sites.map((s) => ({ ...s, manage: canManage(s.id) })) };
}

/** One site's week, Monday to Sunday, with each shift's warnings. */
export async function rotaWeek(siteId: string | undefined, week: string | undefined) {
  const { who, sites } = await rotaSites();
  const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];
  if (!site) { if (siteId) notFound(); return { who, sites, site: null, monday: mondayOf(today()), days: [], people: [], types: [] }; }
  const monday = mondayOf(week && isDateOnly(week) ? week : today());
  const sunday = addDaysIso(monday, 6);
  const shifts = await prisma.rotaShift.findMany({
    where: { siteId: site.id, cancelledAt: null, date: { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) } },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: { id: true, date: true, startMinutes: true, endMinutes: true, role: true, note: true, userId: true, requiredTypeId: true,
      user: { select: { name: true } }, requiredType: { select: { name: true } } },
  });
  const userIds = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
  const [held, elsewhere, absences] = await Promise.all([
    prisma.qualification.findMany({ where: { userId: { in: userIds } }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }),
    // Double-bookings across sites count too.
    prisma.rotaShift.findMany({
      where: { userId: { in: userIds }, cancelledAt: null, date: { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) } },
      select: { id: true, userId: true, date: true, startMinutes: true, endMinutes: true, requiredTypeId: true },
    }),
    // Who is off this week. The week shows only "Absent"; the reason is for managers.
    prisma.rotaAbsence.findMany({
      where: { userId: { in: userIds }, withdrawnAt: null, firstDay: { lte: parseDateOnly(sunday) }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(monday) } }] },
      select: { userId: true, firstDay: true, lastDay: true },
    }),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(monday, i);
    return {
      iso,
      shifts: shifts.filter((s) => s.date.toISOString().slice(0, 10) === iso).map((s) => ({
        ...s,
        warnings: shiftWarnings(s, held.filter((q) => q.userId === s.userId), elsewhere.filter((o) => o.date.toISOString().slice(0, 10) === iso), absences),
      })),
    };
  });
  const [people, types] = site.manage ? await Promise.all([
    prisma.user.findMany({ where: { orgId: who.orgId ?? undefined, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } }),
    prisma.qualificationType.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]) : [[], []];
  return { who, sites, site, monday, days, people, types };
}
export type RotaDay = Awaited<ReturnType<typeof rotaWeek>>["days"][number];

/** The Absences page: who is off now or soon, and who came back in the last
 *  30 days, among the people the manager's rota role covers. Each current or
 *  upcoming absence counts the shifts it leaves without their person. */
export async function rotaAbsences() {
  const who = await requireRotaActor();
  if (!who.manage) throw new AuthorizationError("Managing the rota is required.");
  const reach = await subjectsFor("rota.manage");
  const inReach = reach.kind === "all" ? {} : { userId: { in: [...reach.userIds] } };
  const from = today(), since = addDaysIso(from, -30);
  const rows = await prisma.rotaAbsence.findMany({
    where: { orgId: who.orgId ?? undefined, withdrawnAt: null, ...inReach, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(since) } }] },
    orderBy: [{ firstDay: "asc" }],
    select: { id: true, userId: true, reason: true, firstDay: true, lastDay: true, note: true, reportedByName: true, createdAt: true, user: { select: { name: true } } },
  });
  const open = rows.filter((a) => !a.lastDay || a.lastDay.toISOString().slice(0, 10) >= from);
  const shifts = open.length ? await prisma.rotaShift.findMany({
    where: { userId: { in: open.map((a) => a.userId) }, cancelledAt: null, date: { gte: parseDateOnly(from) } },
    select: { userId: true, date: true },
  }) : [];
  const current = open.map((a) => ({
    ...a, reason: a.reason as AbsenceReason,
    shiftsToCover: shifts.filter((s) => absentOn([a], s.userId!, s.date.toISOString().slice(0, 10))).length,
  }));
  const returned = rows.filter((a) => !open.includes(a)).reverse().map((a) => ({ ...a, reason: a.reason as AbsenceReason }));
  const people = await prisma.user.findMany({
    where: { orgId: who.orgId ?? undefined, isActive: true, ...(reach.kind === "all" ? {} : { id: { in: [...reach.userIds] } }) },
    orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true },
  });
  return { who, today: from, current, returned, people };
}
export type RotaAbsenceRow = Awaited<ReturnType<typeof rotaAbsences>>["current"][number];
