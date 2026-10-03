import "server-only";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor, subjectsFor } from "@/lib/policy/session";
import { requireRotaActor } from "@/lib/rota/access";
import { commitmentsFor } from "@/modules/server";
import { AuthorizationError } from "@/lib/authz";
import { ACTIVITY_SUGGESTIONS, absentOn, addDaysIso, mondayOf, returnStage, samePerson, shiftWarnings, type AbsenceReason, type AbsenceUpdateKind, type PersonRef, type ReturnFit, youngBand, type YoungBand } from "@/lib/rota/constants";

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
  if (!site) { if (siteId) notFound(); return { who, sites, site: null, monday: mondayOf(today()), days: [], people: [], types: [], departments: [], duties: [], young: {} as Record<string, YoungBand> }; }
  const monday = mondayOf(week && isDateOnly(week) ? week : today());
  const sunday = addDaysIso(monday, 6);
  const shifts = await prisma.rotaShift.findMany({
    where: { siteId: site.id, cancelledAt: null, date: { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) } },
    orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    select: { id: true, date: true, startMinutes: true, endMinutes: true, role: true, note: true, userId: true, requiredTypeId: true,
      rotaPersonId: true, kind: true, importId: true, departmentId: true,
      user: { select: { name: true } }, rotaPerson: { select: { name: true } }, requiredType: { select: { name: true } },
      department: { select: { name: true, sortOrder: true } }, bookingId: true, bookingNeed: { select: { role: true } },
      segments: { orderBy: { startMinutes: "asc" }, select: { id: true, startMinutes: true, endMinutes: true, kind: true, label: true } } },
  });
  const userIds = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
  const personIds = [...new Set(shifts.flatMap((s) => (s.rotaPersonId ? [s.rotaPersonId] : [])))];
  const inWeek = { gte: parseDateOnly(monday), lte: parseDateOnly(sunday) };
  const someone = [...(userIds.length ? [{ userId: { in: userIds } }] : []), ...(personIds.length ? [{ rotaPersonId: { in: personIds } }] : [])];
  const [held, elsewhere, absences, teaching, classes, births] = await Promise.all([
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
    // Swim classes the people on these duties teach this week, at any site.
    userIds.length ? commitmentsFor({ userIds, from: monday, to: sunday }) : [],
    // And every class at this site, for the plan's Swim classes row.
    commitmentsFor({ siteIds: [site.id], from: monday, to: sunday }),
    // Under-18s on the plan, for their breaks: only a band per day leaves this function, never the date.
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds }, dateOfBirth: { gt: parseDateOnly(addDaysIso(monday, -18 * 366)) } }, select: { id: true, dateOfBirth: true } }) : [],
  ]);
  const young: Record<string, YoungBand> = {};
  for (const b of births) {
    for (let i = 0; i < 7; i++) {
      const on = addDaysIso(monday, i);
      const band = youngBand(b.dateOfBirth ? b.dateOfBirth.toISOString().slice(0, 10) : null, on);
      if (band) young[`${b.id}:${on}`] = band;
    }
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(monday, i);
    return {
      iso,
      shifts: shifts.filter((s) => s.date.toISOString().slice(0, 10) === iso).map((s) => ({
        ...s,
        warnings: shiftWarnings(s, held.filter((q) => q.userId === s.userId), elsewhere.filter((o) => o.date.toISOString().slice(0, 10) === iso), absences, teaching.filter((c) => c.date === iso)),
      })),
      classes: classes.filter((c) => c.date === iso),
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
  return { who, sites, site, monday, days, people, types, departments, duties: recent.map((r) => r.role), young };
}
export type RotaDay = Awaited<ReturnType<typeof rotaWeek>>["days"][number];

/** The bookings at one site still running or ended in the last 30 days,
 *  with how many of their places still to come are unfilled. */
export async function rotaBookings(siteId: string | undefined) {
  const { who, sites } = await rotaSites();
  const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];
  if (siteId && !site) notFound();
  const now = today();
  if (!site) return { who, sites, site: null, today: now, bookings: [], types: [], departments: [] };
  const orgId = who.orgId ?? undefined;
  const [bookings, ahead, staffed, types, departments] = await Promise.all([
    prisma.rotaBooking.findMany({
      where: { siteId: site.id, cancelledAt: null, lastDay: { gte: parseDateOnly(addDaysIso(now, -30)) } }, orderBy: [{ firstDay: "asc" }, { startMinutes: "asc" }],
      select: { id: true, kind: true, title: true, place: true, weekdays: true, startMinutes: true, endMinutes: true, firstDay: true, lastDay: true, note: true, createdByName: true,
        department: { select: { name: true } }, needs: { select: { role: true, count: true, requiredType: { select: { name: true } } } } },
    }),
    prisma.rotaShift.groupBy({ by: ["bookingId"], where: { siteId: site.id, bookingId: { not: null }, cancelledAt: null, userId: null, date: { gte: parseDateOnly(now) } }, _count: { _all: true } }),
    // Places this week (started, so in Timepoint) that already have someone.
    prisma.rotaShift.groupBy({ by: ["bookingId"], where: { siteId: site.id, bookingId: { not: null }, cancelledAt: null, userId: { not: null }, date: { gte: parseDateOnly(now), lte: parseDateOnly(addDaysIso(mondayOf(now), 6)) } }, _count: { _all: true } }),
    site.manage ? prisma.qualificationType.findMany({ where: { orgId, archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : [],
    site.manage ? prisma.department.findMany({ where: { orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: site.id }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }) : [],
  ]);
  const unfilled = new Map(ahead.map((a) => [a.bookingId, a._count._all]));
  const staffedNow = new Set(staffed.map((s) => s.bookingId));
  return { who, sites, site, today: now, types, departments, bookings: bookings.map((b) => ({ ...b, unfilled: unfilled.get(b.id) ?? 0, staffedThisWeek: staffedNow.has(b.id) })) };
}

/** One day of a site's plan, for the day timeline: the day's duties with what
 *  each person does when (activities and breaks), the bookings that day, the
 *  Swim school's classes and who teaches them, the day's note and the
 *  activities this site has used, to offer again. Same access as the week. */
export async function rotaDay(siteId: string | undefined, date: string | undefined) {
  const day = date && isDateOnly(date) ? date : today();
  const week = await rotaWeek(siteId, day);
  const found = week.days.find((d) => d.iso === day);
  const shifts = (found?.shifts ?? []).filter((s) => s.kind === "shift");
  const classes = found?.classes ?? [];
  const empty = { ...week, day, shifts, classes, bookings: [], note: "", teachers: {} as Record<string, string>, activities: ACTIVITY_SUGGESTIONS,
    planned: [] as { id: string; label: string; startMinutes: number; endMinutes: number; people: number; requiredTypeId: string | null; requiredType: { name: string } | null; note: string }[],
    held: {} as Record<string, string[]>, young: {} as Record<string, YoungBand> };
  if (!week.site) return empty;
  const at = parseDateOnly(day);
  const weekday = (at.getUTCDay() + 6) % 7;
  const teacherIds = [...new Set(classes.flatMap((c) => (c.userId ? [c.userId] : [])))];
  const staffIds = [...new Set(shifts.flatMap((s) => (s.userId ? [s.userId] : [])))];
  const [bookings, note, used, teachers, planned, quals, births] = await Promise.all([
    prisma.rotaBooking.findMany({
      where: { siteId: week.site.id, cancelledAt: null, firstDay: { lte: at }, lastDay: { gte: at }, weekdays: { has: weekday } },
      orderBy: [{ startMinutes: "asc" }],
      select: { id: true, kind: true, title: true, place: true, startMinutes: true, endMinutes: true, needs: { select: { count: true } } },
    }),
    prisma.rotaDayNote.findUnique({ where: { siteId_date: { siteId: week.site.id, date: at } }, select: { text: true } }),
    // Activities used at this site in the last 12 weeks come first in the suggestions.
    prisma.rotaShiftSegment.findMany({
      where: { kind: "activity", shift: { siteId: week.site.id, date: { gte: parseDateOnly(addDaysIso(day, -84)) } } },
      distinct: ["label"], select: { label: true }, take: 40,
    }),
    teacherIds.length ? prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }) : [],
    // The day's planned activities: what needs covering, when, by how many, holding what.
    prisma.rotaActivity.findMany({ where: { siteId: week.site.id, date: at }, orderBy: [{ startMinutes: "asc" }],
      select: { id: true, label: true, startMinutes: true, endMinutes: true, people: true, requiredTypeId: true, requiredType: { select: { name: true } }, note: true } }),
    // What the people on the plan hold that day, so only those with the right one are suggested first.
    staffIds.length ? prisma.qualification.findMany({ where: { userId: { in: staffIds }, revokedAt: null, issuedOn: { lte: at }, OR: [{ expiresOn: null }, { expiresOn: { gte: at } }] }, select: { userId: true, typeId: true } }) : [],
    // Under-18s on the plan, for their breaks: only the band leaves this function, never the date.
    staffIds.length ? prisma.user.findMany({ where: { id: { in: staffIds }, dateOfBirth: { gt: parseDateOnly(addDaysIso(day, -18 * 366)) } }, select: { id: true, dateOfBirth: true } }) : [],
  ]);
  const young: Record<string, YoungBand> = {};
  for (const b of births) { const band = youngBand(b.dateOfBirth ? b.dateOfBirth.toISOString().slice(0, 10) : null, day); if (band) young[b.id] = band; }
  const held: Record<string, string[]> = {};
  for (const q of quals) (held[q.userId] ??= []).push(q.typeId);
  const placed = (id: string) => shifts.filter((s) => s.bookingId === id);
  return {
    ...empty,
    bookings: bookings.map(({ needs, ...b }) => ({
      ...b, places: placed(b.id).length || needs.reduce((n, w) => n + w.count, 0),
      filled: placed(b.id).filter((s) => (s.userId || s.rotaPersonId) && !s.warnings.includes("absent")).length,
    })),
    note: note?.text ?? "",
    teachers: Object.fromEntries(teachers.map((t) => [t.id, t.name])),
    activities: [...new Set([...planned.map((p) => p.label), ...used.map((u) => u.label), ...ACTIVITY_SUGGESTIONS])],
    planned, held, young,
  };
}

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
  const classes = day?.classes ?? [];
  if (!week.site) return { ...week, today: now, minutesNow, shifts, classes, teachers: {} as Record<string, string>, needs: [], changes: [], bookings: [] };
  const date = parseDateOnly(now);
  const orgId = week.who.orgId ?? undefined;
  const weekday = (new Date(`${now}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [busy, off, held, changes, teaching, bookings] = await Promise.all([
    // Everyone's duties today, at any site, so cover never double-books.
    prisma.rotaShift.findMany({ where: { orgId, date, kind: "shift", cancelledAt: null, userId: { not: null } }, select: { userId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaAbsence.findMany({ where: { orgId, withdrawnAt: null, userId: { not: null }, firstDay: { lte: date }, OR: [{ lastDay: null }, { lastDay: { gte: date } }] }, select: { userId: true } }),
    prisma.qualification.findMany({ where: { orgId, revokedAt: null, issuedOn: { lte: date }, OR: [{ expiresOn: null }, { expiresOn: { gte: date } }] }, select: { userId: true, typeId: true } }),
    prisma.rotaShiftChange.findMany({ where: { siteId: week.site.id, date }, orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, before: true, after: true, reason: true, note: true, byName: true, createdAt: true, timepointAt: true, timepointByName: true } }),
    // Swim classes anyone teaches today, so cover never lands on someone teaching.
    week.site.manage && week.people.length ? commitmentsFor({ userIds: week.people.map((p) => p.id), from: now, to: now }) : [],
    // Today's bookings at this site: on the timeline beside the duties they need.
    prisma.rotaBooking.findMany({
      where: { siteId: week.site.id, cancelledAt: null, firstDay: { lte: date }, lastDay: { gte: date }, weekdays: { has: weekday } },
      orderBy: [{ startMinutes: "asc" }],
      select: { id: true, kind: true, title: true, place: true, startMinutes: true, endMinutes: true, needs: { select: { count: true } } },
    }),
  ]);
  const offIds = new Set(off.map((a) => a.userId));
  // Free and qualified for this duty's time: not off, not on another duty then.
  const coverFor = (s: (typeof shifts)[number]) => week.people.filter((p) => p.id !== s.userId && !offIds.has(p.id)
    && ![...busy, ...teaching].some((b) => b.userId === p.id && b.startMinutes < s.endMinutes && s.startMinutes < b.endMinutes)
    && (!s.requiredTypeId || held.some((q) => q.userId === p.id && q.typeId === s.requiredTypeId))).slice(0, 3);
  const needs = shifts
    .filter((s) => s.endMinutes > minutesNow && (s.warnings.includes("absent") || (!s.userId && !s.rotaPersonId)))
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((s) => ({ shift: s, absent: s.warnings.includes("absent"), cover: week.site!.manage ? coverFor(s) : [] }));
  // How many of each booking's places today have someone.
  const placed = (id: string) => shifts.filter((s) => s.bookingId === id);
  const todayBookings = bookings.map(({ needs: wanted, ...b }) => ({
    ...b, places: placed(b.id).length || wanted.reduce((n, w) => n + w.count, 0),
    filled: placed(b.id).filter((s) => (s.userId || s.rotaPersonId) && !s.warnings.includes("absent")).length,
  }));
  // Who teaches today's swim classes, by name, for the timeline's Swim school lanes.
  const teacherIds = [...new Set(classes.flatMap((c) => (c.userId ? [c.userId] : [])))];
  const teachers = teacherIds.length ? await prisma.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, name: true } }) : [];
  return { ...week, today: now, minutesNow, shifts, classes, teachers: Object.fromEntries(teachers.map((t) => [t.id, t.name])), needs, changes, bookings: todayBookings };
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
