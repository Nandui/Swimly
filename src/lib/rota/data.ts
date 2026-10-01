import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { AuthorizationError } from "@/lib/authz";
import { absentOn, addDaysIso, mondayOf, samePerson, shiftWarnings, type AbsenceReason, type AbsenceUpdateKind, type PersonRef } from "@/lib/rota/constants";

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
      rotaPersonId: true, kind: true, departmentCode: true, importId: true,
      user: { select: { name: true } }, rotaPerson: { select: { name: true, employeeNo: true } }, requiredType: { select: { name: true } } },
  });
  const userIds = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
  const personIds = [...new Set(shifts.flatMap((s) => (s.rotaPersonId ? [s.rotaPersonId] : [])))];
  const inWeek = { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) };
  const someone = [...(userIds.length ? [{ userId: { in: userIds } }] : []), ...(personIds.length ? [{ rotaPersonId: { in: personIds } }] : [])];
  const [held, elsewhere, absences] = await Promise.all([
    prisma.qualification.findMany({ where: { userId: { in: userIds } }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }),
    // Double-bookings across sites count too.
    someone.length ? prisma.rotaShift.findMany({
      where: { OR: someone, cancelledAt: null, date: inWeek },
      select: { id: true, userId: true, rotaPersonId: true, kind: true, date: true, startMinutes: true, endMinutes: true, requiredTypeId: true },
    }) : [],
    // Who is off this week. The week shows only "Absent"; the reason is for managers.
    someone.length ? prisma.rotaAbsence.findMany({
      where: { OR: someone, withdrawnAt: null, firstDay: { lte: parseDateOnly(sunday) }, AND: [{ OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(monday) } }] }] },
      select: { userId: true, rotaPersonId: true, firstDay: true, lastDay: true },
    }) : [],
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
  const orgId = who.orgId ?? undefined;
  const from = today(), since = addDaysIso(from, -30), soon = addDaysIso(from, 13);
  const { users, rosterPeople } = await absenceReach(orgId);
  const inReach = { OR: [...(users === "all" ? [{ userId: { not: null } }] : [{ userId: { in: users } }]), { rotaPersonId: { in: rosterPeople.map((p) => p.id) } }] };
  const rows = await prisma.rotaAbsence.findMany({
    where: { orgId, withdrawnAt: null, AND: [inReach, { OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(since) } }] }] },
    orderBy: [{ firstDay: "asc" }],
    select: { id: true, userId: true, rotaPersonId: true, reason: true, firstDay: true, lastDay: true, note: true, reportedByName: true, createdAt: true,
      user: { select: { name: true } }, rotaPerson: { select: { name: true } },
      continues: { select: { firstDay: true, lastDay: true, reason: true } },
      updates: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, lastDay: true, note: true, byName: true, createdAt: true } } },
  });
  const named = rows.map(({ user, rotaPerson, updates, ...a }) => ({
    ...a, user: { name: rotaPerson?.name ?? user?.name ?? "Someone" },
    updates: updates.map((u) => ({ ...u, kind: u.kind as AbsenceUpdateKind })),
    extensions: updates.filter((u) => u.kind === "extended").length,
  }));
  const open = named.filter((a) => !a.lastDay || a.lastDay.toISOString().slice(0, 10) >= from);
  const whose = open.flatMap((a) => [...(a.userId ? [{ userId: a.userId }] : []), ...(a.rotaPersonId ? [{ rotaPersonId: a.rotaPersonId }] : [])]);
  const shifts = whose.length ? await prisma.rotaShift.findMany({
    where: { OR: whose, kind: "shift", cancelledAt: null, date: { gte: parseDateOnly(from) } },
    select: { userId: true, rotaPersonId: true, date: true },
  }) : [];
  const current = open.map((a) => ({
    ...a, reason: a.reason as AbsenceReason,
    shiftsToCover: shifts.filter((s) => absentOn([a], s, s.date.toISOString().slice(0, 10))).length,
  }));
  const returned = named.filter((a) => !open.includes(a)).reverse().map((a) => ({ ...a, reason: a.reason as AbsenceReason }));
  // Holiday from the roster in the next two weeks: planned, so not reported here, but shown.
  const holidays = await prisma.rotaShift.findMany({
    where: { orgId, kind: { not: "shift" }, cancelledAt: null, date: { gte: parseDateOnly(from), lte: parseDateOnly(soon) }, rotaPersonId: { in: rosterPeople.map((p) => p.id) } },
    orderBy: [{ date: "asc" }], select: { id: true, date: true, kind: true, note: true, rotaPerson: { select: { name: true } }, site: { select: { name: true } } },
  });
  // Anyone who can be reported off: everyone on the roster, and anyone with an account who is not on it.
  const accounts = await prisma.user.findMany({
    where: { orgId, isActive: true, rotaPerson: null, ...(users === "all" ? {} : { id: { in: users } }) },
    orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true },
  });
  // Each person's recent absences, so reporting again can ask "is this an extension?"
  const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;
  const recentOf = (ref: PersonRef) => named.filter((a) => samePerson(a, ref)).map((a) => ({ id: a.id, reason: a.reason as AbsenceReason, firstDay: iso(a.firstDay)!, lastDay: iso(a.lastDay) }));
  const people = [
    ...rosterPeople.map((p) => ({ id: `p:${p.id}`, name: p.name, jobTitle: `No. ${p.employeeNo}`, absences: recentOf({ rotaPersonId: p.id, userId: p.userId }) })),
    ...accounts.map((u) => ({ id: `u:${u.id}`, name: u.name, jobTitle: u.jobTitle, absences: recentOf({ userId: u.id }) })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return { who, today: from, current, returned, people, holidays };
}

/** Whose absences this manager may see and record: the accounts their rota
 *  role covers, and everyone on the roster at the sites it covers (all of it
 *  for a role that covers every site). */
async function absenceReach(orgId: string | undefined) {
  const [reach, sites] = await Promise.all([subjectsFor("rota.manage"), sitesFor("rota.manage")]);
  const recent = { gte: parseDateOnly(addDaysIso(today(), -56)) };
  const rosterPeople = await prisma.rotaPerson.findMany({
    where: { orgId, ...(sites.kind === "all" ? {} : { shifts: { some: { siteId: { in: [...sites.siteIds] }, date: recent } } }) },
    orderBy: { name: "asc" }, select: { id: true, name: true, employeeNo: true, userId: true },
  });
  return { users: reach.kind === "all" ? "all" as const : [...reach.userIds], rosterPeople };
}
export type RotaAbsenceRow = Awaited<ReturnType<typeof rotaAbsences>>["current"][number];

/** Each roster upload, newest first, and what the chosen one changed. */
export async function rotaChanges(importId: string | undefined) {
  const who = await requireRotaActor();
  if (!who.manage) throw new AuthorizationError("Managing the rota is required.");
  const imports = await prisma.rotaImport.findMany({
    where: { orgId: who.orgId ?? undefined }, orderBy: { createdAt: "desc" }, take: 30,
    select: { id: true, weekStart: true, fileName: true, importedByName: true, createdAt: true, people: true, shifts: true, holidays: true, added: true, removed: true, changed: true },
  });
  const selected = imports.find((i) => i.id === importId) ?? imports[0] ?? null;
  const changes = selected ? await prisma.rotaChange.findMany({
    where: { importId: selected.id }, orderBy: [{ date: "asc" }, { personName: "asc" }],
    select: { id: true, date: true, employeeNo: true, personName: true, kind: true, before: true, after: true },
  }) : [];
  return { imports, selected, changes };
}
