import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { AuthorizationError } from "@/lib/authz";
import { absentOn, addDaysIso, mondayOf, returnStage, samePerson, shiftWarnings, type AbsenceReason, type AbsenceUpdateKind, type PersonRef, type ReturnFit } from "@/lib/rota/constants";

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
  if (!site) { if (siteId) notFound(); return { who, sites, site: null, monday: mondayOf(today()), days: [], people: [], types: [], departments: [], duties: [] }; }
  const monday = mondayOf(week && isDateOnly(week) ? week : today());
  const sunday = addDaysIso(monday, 6);
  const shifts = await prisma.rotaShift.findMany({
    where: { siteId: site.id, cancelledAt: null, date: { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) } },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: { id: true, date: true, startMinutes: true, endMinutes: true, role: true, note: true, userId: true, requiredTypeId: true,
      rotaPersonId: true, kind: true, importId: true, departmentId: true,
      user: { select: { name: true } }, rotaPerson: { select: { name: true } }, requiredType: { select: { name: true } },
      department: { select: { name: true, sortOrder: true } } },
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
  const orgId = who.orgId ?? undefined;
  const [people, types, departments, recent] = site.manage ? await Promise.all([
    prisma.user.findMany({ where: { orgId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, jobTitle: true } }),
    prisma.qualificationType.findMany({ where: { orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // The site's departments, and the organisation-wide ones.
    prisma.department.findMany({ where: { orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: site.id }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    // Duties typed before at this site, offered again (owner decision: supervisors type them).
    prisma.rotaShift.findMany({ where: { siteId: site.id, kind: "shift", importId: null, date: { gte: parseDateOnly(addDaysIso(monday, -84)) } }, distinct: ["role"], orderBy: { role: "asc" }, select: { role: true } }),
  ]) : [[], [], [], []];
  return { who, sites, site, monday, days, people, types, departments, duties: recent.map((r) => r.role) };
}
export type RotaDay = Awaited<ReturnType<typeof rotaWeek>>["days"][number];

/** Today's plan for duty managers: the day's duties at one site, what needs
 *  them now (duties whose person is off, with who could cover; unfilled ones
 *  still to come) and the changes made to today's duties, with their reason
 *  and whether Timepoint has them. */
export async function rotaToday(siteId: string | undefined) {
  const now = today();
  const week = await rotaWeek(siteId, now);
  const day = week.days.find((d) => d.iso === now);
  const shifts = (day?.shifts ?? []).filter((s) => s.kind === "shift");
  const clockNow = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Dublin" }).format(new Date());
  const minutesNow = Number(clockNow.slice(0, 2)) * 60 + Number(clockNow.slice(3, 5));
  if (!week.site) return { ...week, today: now, minutesNow, shifts, needs: [], changes: [] };
  const date = parseDateOnly(now);
  const orgId = week.who.orgId ?? undefined;
  const [busy, off, held, changes] = await Promise.all([
    // Everyone's duties today, at any site, so cover never double-books.
    prisma.rotaShift.findMany({ where: { orgId, date, kind: "shift", cancelledAt: null, userId: { not: null } }, select: { userId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaAbsence.findMany({ where: { orgId, withdrawnAt: null, userId: { not: null }, firstDay: { lte: date }, OR: [{ lastDay: null }, { lastDay: { gte: date } }] }, select: { userId: true } }),
    prisma.qualification.findMany({ where: { orgId, revokedAt: null, issuedOn: { lte: date }, OR: [{ expiresOn: null }, { expiresOn: { gte: date } }] }, select: { userId: true, typeId: true } }),
    prisma.rotaShiftChange.findMany({ where: { siteId: week.site.id, date }, orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, before: true, after: true, reason: true, note: true, byName: true, createdAt: true, timepointAt: true, timepointByName: true } }),
  ]);
  const offIds = new Set(off.map((a) => a.userId));
  // Free and qualified for this duty's time: not off, not on another duty then.
  const coverFor = (s: (typeof shifts)[number]) => week.people.filter((p) => p.id !== s.userId && !offIds.has(p.id)
    && !busy.some((b) => b.userId === p.id && b.startMinutes < s.endMinutes && s.startMinutes < b.endMinutes)
    && (!s.requiredTypeId || held.some((q) => q.userId === p.id && q.typeId === s.requiredTypeId))).slice(0, 3);
  const needs = shifts
    .filter((s) => s.endMinutes > minutesNow && (s.warnings.includes("absent") || (!s.userId && !s.rotaPersonId)))
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((s) => ({ shift: s, absent: s.warnings.includes("absent"), cover: week.site!.manage ? coverFor(s) : [] }));
  return { ...week, today: now, minutesNow, shifts, needs, changes };
}

/** The Absences page, among the people the manager's rota role covers: who
 *  is off now or soon, whose return to work is still to record, and who came
 *  back in the last 30 days. Each current or upcoming absence counts the
 *  shifts it leaves without their person. */
export async function rotaAbsences() {
  const who = await requireRotaActor();
  if (!who.manage) throw new AuthorizationError("Managing the rota is required.");
  const orgId = who.orgId ?? undefined;
  const from = today(), since = addDaysIso(from, -30), soon = addDaysIso(from, 13);
  const { users, rosterPeople } = await absenceReach(orgId);
  const inReach = { OR: [...(users === "all" ? [{ userId: { not: null } }] : [{ userId: { in: users } }]), { rotaPersonId: { in: rosterPeople.map((p) => p.id) } }] };
  const rows = await prisma.rotaAbsence.findMany({
    // Current ones, those back in the last 30 days, and any return to work still to record.
    where: { orgId, withdrawnAt: null, AND: [inReach, { OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(since) } }, { returnMetOn: null }] }] },
    orderBy: [{ firstDay: "asc" }],
    select: { id: true, userId: true, rotaPersonId: true, reason: true, firstDay: true, lastDay: true, note: true, reportedByName: true, createdAt: true,
      returnMetOn: true, returnFit: true, returnAdjustments: true, returnFitNote: true, returnNote: true, returnByName: true,
      user: { select: { name: true } }, rotaPerson: { select: { name: true } },
      continues: { select: { firstDay: true, lastDay: true, reason: true } },
      updates: { orderBy: { createdAt: "asc" }, select: { id: true, kind: true, lastDay: true, note: true, byName: true, createdAt: true } } },
  });
  const named = rows.map(({ user, rotaPerson, updates, returnFit, ...a }) => ({
    ...a, returnFit: returnFit as ReturnFit | null, user: { name: rotaPerson?.name ?? user?.name ?? "Someone" },
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
  // Back: the return to work is due from their first shift after the absence,
  // and waits there until it is recorded.
  const ended = named.filter((a) => !open.includes(a)).reverse().map((a) => ({ ...a, reason: a.reason as AbsenceReason }));
  const firstShifts = await firstShiftsBack(ended.filter((a) => !a.returnMetOn));
  const staged = ended.map((a) => {
    const firstShift = firstShifts.get(a.id) ?? null;
    return { ...a, firstShift, stage: returnStage({ lastDay: iso(a.lastDay)!, returnMetOn: iso(a.returnMetOn) }, firstShift, from) };
  });
  const returning = staged.filter((a) => a.stage !== "recorded");
  const returned = staged.filter((a) => a.stage === "recorded");
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
  const recentOf = (ref: PersonRef) => named.filter((a) => samePerson(a, ref)).map((a) => ({ id: a.id, reason: a.reason as AbsenceReason, firstDay: iso(a.firstDay)!, lastDay: iso(a.lastDay) }));
  const people = [
    ...rosterPeople.map((p) => ({ id: `p:${p.id}`, name: p.name, jobTitle: `No. ${p.employeeNo}`, absences: recentOf({ rotaPersonId: p.id, userId: p.userId }) })),
    ...accounts.map((u) => ({ id: `u:${u.id}`, name: u.name, jobTitle: u.jobTitle, absences: recentOf({ userId: u.id }) })),
  ].sort((a, b) => a.name.localeCompare(b.name));
  return { who, today: from, current, returning, returned, people, holidays };
}

const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;

/** For the home page: how many returns to work are due now (their first
 *  shift back has come) among the people this manager covers. */
export async function returnsToWorkDue() {
  const who = await requireRotaActor();
  if (!who.manage) return 0;
  const orgId = who.orgId ?? undefined, from = today();
  const { users, rosterPeople } = await absenceReach(orgId);
  const inReach = { OR: [...(users === "all" ? [{ userId: { not: null } }] : [{ userId: { in: users } }]), { rotaPersonId: { in: rosterPeople.map((p) => p.id) } }] };
  const ended = await prisma.rotaAbsence.findMany({
    where: { orgId, withdrawnAt: null, returnMetOn: null, lastDay: { lt: parseDateOnly(from) }, AND: [inReach] },
    select: { id: true, userId: true, rotaPersonId: true, lastDay: true },
  });
  const firstShifts = await firstShiftsBack(ended);
  return ended.filter((a) => returnStage({ lastDay: iso(a.lastDay)!, returnMetOn: null }, firstShifts.get(a.id) ?? null, from) === "due").length;
}

/** The date of each ended absence's first shift back: the person's first
 *  rostered shift after their last day off. Absences with none are left out. */
async function firstShiftsBack(absences: { id: string; userId: string | null; rotaPersonId: string | null; lastDay: Date | null }[]) {
  const out = new Map<string, string>();
  const ended = absences.filter((a) => a.lastDay);
  if (!ended.length) return out;
  const whose = ended.flatMap((a) => [...(a.userId ? [{ userId: a.userId }] : []), ...(a.rotaPersonId ? [{ rotaPersonId: a.rotaPersonId }] : [])]);
  const earliest = ended.map((a) => a.lastDay!).sort((x, y) => x.getTime() - y.getTime())[0];
  const shifts = await prisma.rotaShift.findMany({
    where: { OR: whose, kind: "shift", cancelledAt: null, date: { gt: earliest } },
    orderBy: [{ date: "asc" }], select: { userId: true, rotaPersonId: true, date: true },
  });
  for (const a of ended) {
    const first = shifts.find((s) => s.date > a.lastDay! && samePerson(a, s));
    if (first) out.set(a.id, iso(first.date)!);
  }
  return out;
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
export type RotaReturnRow = Awaited<ReturnType<typeof rotaAbsences>>["returning"][number];
