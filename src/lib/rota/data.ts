import "server-only";
import { areaNames } from "@/lib/setup/data";
import { notFound } from "next/navigation";
import { isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { canChange, requireRotaActor, type RotaActor } from "@/lib/rota/access";
import { addDaysIso, mondayOf, youngBand, youngRest, type YoungBand } from "@/lib/rota/constants";
import { buildDay, type DayClass, type DayType } from "@/lib/rota/day";
import { rankFits, type Held } from "@/lib/rota/fit";
import type { PinnedBreak, WorkItem } from "@/lib/rota/shifts";
import { commitmentsFor } from "@/modules/server";

/** Rota reads (owner decisions, 6 October 2026). The sites a person may see come from the policy
 *  engine; a site outside them is a 404, never an empty rota. Every day is laid out by
 *  `buildDay`, so Plan, Today and Turnfin Me agree. */

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const CLASSES = "activities.classes";

export async function rotaSites() {
  const who = await requireRotaActor();
  const [view, plan, run] = await Promise.all([sitesFor("rota.view"), who.plan ? sitesFor("rota.plan") : null, who.run ? sitesFor("rota.manage") : null]);
  const sites = await prisma.club.findMany({
    where: { archivedAt: null, orgId: who.orgId ?? undefined, ...(view.kind === "all" ? {} : { id: { in: [...view.siteIds] } }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
  const holds = (s: Awaited<ReturnType<typeof sitesFor>> | null, id: string) => !!s && (s.kind === "all" || s.siteIds.has(id));
  return { who, sites: sites.map((s) => ({ ...s, plan: holds(plan, s.id) || holds(run, s.id), run: holds(run, s.id) })) };
}
export type RotaSite = Awaited<ReturnType<typeof rotaSites>>["sites"][number];

async function pickSite(siteId: string | undefined) {
  const { who, sites } = await rotaSites();
  const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];
  if (siteId && !site) notFound();
  return { who, sites, site: site ?? null };
}

/** A site's departments: its own and the organisation-wide ones. */
function siteDepartments(orgId: string | undefined, siteId: string) {
  return prisma.department.findMany({
    where: { orgId, archivedAt: null, OR: [{ clubId: null }, { clubId: siteId }] },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true },
  });
}

/** The organisation's activity list, as `buildDay` takes it. */
async function activityTypes(orgId: string | undefined, includeArchived = false): Promise<(DayType & { archived: boolean; departmentName: string })[]> {
  const rows = await prisma.activityType.findMany({
    where: { orgId, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, icon: true, departmentId: true, requiredTypeId: true, fromClasses: true, archivedAt: true,
      requiredType: { select: { name: true } }, department: { select: { name: true } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon, departmentId: r.departmentId, departmentName: r.department.name, requiredTypeId: r.requiredTypeId,
    requiredName: r.requiredType?.name ?? null, fromClasses: r.fromClasses, archived: !!r.archivedAt }));
}

/** Everything `buildDay` needs for each day from `from` to `to` at one site. */
async function loadDays(siteId: string, orgId: string | undefined, from: string, to: string) {
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  const [types, needs, classes, planned, pinned] = await Promise.all([
    activityTypes(orgId, true),
    prisma.rotaNeed.findMany({
      where: { siteId, date: range }, orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
      select: { id: true, date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true, note: true, repeat: { select: { title: true } },
        assignments: { select: { id: true, needId: true, place: true, userId: true, startMinutes: true, endMinutes: true } } },
    }),
    commitmentsFor({ siteIds: [siteId], from, to }).then((all) => all.filter((c) => c.source === CLASSES)),
    prisma.rotaPlanShift.findMany({ where: { siteId, date: range }, select: { id: true, date: true, userId: true, departmentId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaBreak.findMany({ where: { siteId, date: range }, orderBy: { startMinutes: "asc" }, select: { date: true, userId: true, startMinutes: true, minutes: true, paid: true } }),
  ]);
  const userIds = [...new Set([...needs.flatMap((n) => n.assignments.map((a) => a.userId)), ...classes.flatMap((c) => (c.userId ? [c.userId] : [])), ...planned.map((p) => p.userId)])];
  const [users, held, absences, elsewhere, elsewhereClasses] = userIds.length ? await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, dateOfBirth: true } }),
    prisma.qualification.findMany({ where: { userId: { in: userIds } }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }),
    prisma.rotaAbsence.findMany({
      where: { userId: { in: userIds }, withdrawnAt: null, firstDay: { lte: parseDateOnly(to) }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(from) } }] },
      select: { userId: true, firstDay: true, lastDay: true },
    }),
    // The same people on activities at other sites, for double bookings.
    prisma.rotaAssignment.findMany({
      where: { userId: { in: userIds }, need: { siteId: { not: siteId }, date: range } },
      select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true, type: { select: { name: true } }, site: { select: { name: true } } } } },
    }),
    commitmentsFor({ userIds, from, to }).then((all) => all.filter((c) => c.siteId !== siteId)),
  ]) : [[], [], [], [], []];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const rest = await youngDays(users, from, to);
  const heldList: Held[] = held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: isoOf(q.issuedOn), expiresOn: q.expiresOn ? isoOf(q.expiresOn) : null, revoked: !!q.revokedAt }));
  // Where an activity happens: the site's areas, kept in Admin; the day is grouped by them.
  const places = await areaNames(siteId);
  const dayInput = (date: string) => {
    const off = new Set(absences.filter((a) => a.userId && isoOf(a.firstDay) <= date && (!a.lastDay || isoOf(a.lastDay) >= date)).map((a) => a.userId!));
    const away = new Map<string, WorkItem[]>();
    for (const a of elsewhere) if (isoOf(a.need.date) === date) away.set(a.userId, [...(away.get(a.userId) ?? []), { start: a.startMinutes, end: a.endMinutes, label: `${a.need.type.name} at ${a.need.site.name}` }]);
    for (const c of elsewhereClasses) if (c.date === date && c.userId) away.set(c.userId, [...(away.get(c.userId) ?? []), { start: c.startMinutes, end: c.endMinutes, label: c.label }]);
    const young = new Map<string, YoungBand>();
    for (const u of users) { const band = youngBand(u.dateOfBirth ? isoOf(u.dateOfBirth) : null, date); if (band) young.set(u.id, band); }
    const dayNeeds = needs.filter((n) => isoOf(n.date) === date);
    const pins = new Map<string, PinnedBreak[]>();
    for (const b of pinned) if (isoOf(b.date) === date) pins.set(b.userId, [...(pins.get(b.userId) ?? []), { start: b.startMinutes, minutes: b.minutes, paid: b.paid }]);
    const restOn = new Map<string, string[]>();
    for (const [userId, days] of rest) { const w = youngRest(young.get(userId) ?? null, date, days); if (w.length) restOn.set(userId, w); }
    return {
      date, types, names, held: heldList, off, elsewhere: away, young, areas: places, pinned: pins, rest: restOn,
      planned: planned.filter((p) => isoOf(p.date) === date).map((p) => ({ id: p.id, userId: p.userId, departmentId: p.departmentId, startMinutes: p.startMinutes, endMinutes: p.endMinutes })),
      needs: dayNeeds.map((n) => ({ id: n.id, typeId: n.typeId, place: n.place, startMinutes: n.startMinutes, endMinutes: n.endMinutes, places: n.places, note: n.note, repeatTitle: n.repeat?.title ?? null })),
      assignments: dayNeeds.flatMap((n) => n.assignments),
      classes: classes.filter((c) => c.date === date && c.ref).map((c): DayClass => ({ ref: c.ref!, userId: c.userId, startMinutes: c.startMinutes, endMinutes: c.endMinutes,
        title: c.title ?? c.label, place: c.place ?? "", planned: !!c.planned })),
    };
  };
  return { types, dayInput, places };
}

/** For the under-18s among these people: each day they work, at any site, from the day before
 *  `from` to the end of the week after `to`, with its first start and last finish, for their
 *  rest warnings (`youngRest`). Rota activities, planned shifts and swim classes count. */
async function youngDays(users: readonly { id: string; dateOfBirth: Date | null }[], from: string, to: string) {
  const ids = users.filter((u) => youngBand(u.dateOfBirth ? isoOf(u.dateOfBirth) : null, to) || youngBand(u.dateOfBirth ? isoOf(u.dateOfBirth) : null, from)).map((u) => u.id);
  const out = new Map<string, Map<string, { start: number; end: number }>>();
  if (!ids.length) return out;
  const first = addDaysIso(mondayOf(from), -1), last = addDaysIso(mondayOf(to), 7);
  const range = { gte: parseDateOnly(first), lte: parseDateOnly(last) };
  const [assigned, shifts, classes] = await Promise.all([
    prisma.rotaAssignment.findMany({ where: { userId: { in: ids }, need: { date: range } }, select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true } } } }),
    prisma.rotaPlanShift.findMany({ where: { userId: { in: ids }, date: range }, select: { userId: true, date: true, startMinutes: true, endMinutes: true } }),
    commitmentsFor({ userIds: ids, from: first, to: last }).then((all) => all.filter((c) => c.source === CLASSES)),
  ]);
  const add = (userId: string, date: string, start: number, end: number) => {
    const days = out.get(userId) ?? new Map<string, { start: number; end: number }>();
    const d = days.get(date);
    days.set(date, d ? { start: Math.min(d.start, start), end: Math.max(d.end, end) } : { start, end });
    out.set(userId, days);
  };
  for (const a of assigned) add(a.userId, isoOf(a.need.date), a.startMinutes, a.endMinutes);
  for (const p of shifts) add(p.userId, isoOf(p.date), p.startMinutes, p.endMinutes);
  for (const c of classes) if (c.userId) add(c.userId, c.date, c.startMinutes, c.endMinutes);
  return out;
}

/** The departments this person belongs to: where Plan lets them change the days ahead. */
async function memberOf(userId: string) {
  return new Set((await prisma.userDepartment.findMany({ where: { userId }, orderBy: { isPrimary: "desc" }, select: { departmentId: true } })).map((m) => m.departmentId));
}

/** The supervisor's Plan: one department's week at one site, a day of it laid out. It opens on
 *  the viewer's own department and, in the week shown, on today or the week's first day. */
export async function planWeek(input: { site?: string; week?: string; dept?: string; day?: string }) {
  const { who, sites, site } = await pickSite(input.site);
  const now = today();
  const monday = mondayOf(input.day && isDateOnly(input.day) ? input.day : input.week && isDateOnly(input.week) ? input.week : now);
  const sunday = addDaysIso(monday, 6);
  if (!site) return { who, sites, site: null, monday, now } as const;
  const orgId = who.orgId ?? undefined;
  const [departments, mine] = await Promise.all([siteDepartments(orgId, site.id), memberOf(who.id)]);
  const department = departments.find((d) => d.id === input.dept) ?? departments.find((d) => mine.has(d.id)) ?? departments[0] ?? null;
  const date = input.day && isDateOnly(input.day) && input.day >= monday && input.day <= sunday ? input.day : now >= monday && now <= sunday ? now : monday;
  const { types, dayInput, places } = await loadDays(site.id, orgId, monday, sunday);
  const inDept = (d: ReturnType<typeof buildDay>) => ({ ...d, groups: d.groups.filter((g) => g.departmentId === department?.id) });
  const week = Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysIso(monday, i);
    const d = inDept(buildDay(dayInput(iso)));
    return { iso, gapCount: d.groups.reduce((n, g) => n + g.gapCount, 0), planned: d.groups.length > 0 };
  });
  const full = buildDay(dayInput(date));
  const groups = full.groups.filter((g) => g.departmentId === department?.id);
  // The areas with something of this department's in them, each showing only that.
  const zones = full.zones.map((z) => {
    const mine = z.groups.filter((g) => g.departmentId === department?.id);
    return { ...z, groups: mine, gapCount: mine.reduce((n, g) => n + g.gapCount, 0) };
  }).filter((z) => z.groups.length);
  // Everyone on this department's activities, and everyone put on a shift on its plan.
  const people = full.people.filter((p) => p.planned.some((x) => x.departmentId === department?.id) || groups.some((g) => g.lanes.some((l) => l.some((b) => b.userId === p.userId))))
    .map((p) => ({ ...p, options: p.options.filter((o) => o.departmentId === department?.id) }));
  const share = department ? await prisma.rotaWeekShare.findUnique({
    where: { siteId_departmentId_monday: { siteId: site.id, departmentId: department.id, monday: parseDateOnly(monday) } }, select: { sharedAt: true, sharedByName: true },
  }) : null;
  const at = { plan: site.plan, run: site.run };
  return {
    who, sites, site, monday, now, date, departments, department, week, share,
    day: { ...full, zones, groups, people, gapCount: groups.reduce((n, g) => n + g.gapCount, 0) },
    canChange: !!department && canChange(at, date, now, department.id, mine),
    canShare: !!department && (site.run || (site.plan && mine.has(department.id))),
    types: types.filter((t) => !t.archived && t.departmentId === department?.id && !t.fromClasses),
    places,
  } as const;
}

/** The duty manager's Today: the whole site, every department. */
export async function todayAt(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  const now = today();
  if (!site) return { who, sites, site: null, now } as const;
  const orgId = who.orgId ?? undefined;
  const { types, dayInput, places } = await loadDays(site.id, orgId, now, now);
  const day = buildDay(dayInput(now));
  const [changes, note, off] = await Promise.all([
    prisma.rotaLog.findMany({ where: { siteId: site.id, OR: [{ date: parseDateOnly(now) }, { timepointAt: null }] }, orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, date: true, summary: true, reason: true, note: true, byName: true, createdAt: true, timepointAt: true, timepointByName: true } }),
    prisma.rotaDayNote.findUnique({ where: { siteId_date: { siteId: site.id, date: parseDateOnly(now) } }, select: { text: true, byName: true, updatedAt: true } }),
    // Who is off today among the people who work here.
    prisma.rotaAbsence.findMany({
      where: { orgId, withdrawnAt: null, userId: { not: null }, firstDay: { lte: parseDateOnly(now) }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(now) } }],
        user: { OR: [{ siteIds: { has: site.id } }, { siteIds: { isEmpty: true } }] } },
      orderBy: { firstDay: "asc" }, select: { id: true, userId: true, reason: true, firstDay: true, lastDay: true, reportedByName: true, createdAt: true, user: { select: { name: true } } },
    }),
  ]);
  return { who, sites, site, now, day, changes, note, off, types: types.filter((t) => !t.archived && !t.fromClasses), places } as const;
}

/** "Who can fill it" for one gap: everyone who works at the site, best fit first. */
export async function fitsFor(input: { siteId: string; date: string; start: number; end: number; requiredTypeId: string | null }) {
  const who = await requireRotaActor();
  const orgId = who.orgId ?? undefined;
  if (!(await mayFor("rota.view", { siteId: input.siteId, orgId }))) return [];
  const people = await prisma.user.findMany({
    where: { orgId, isActive: true, OR: [{ siteIds: { has: input.siteId } }, { siteIds: { isEmpty: true } }] },
    orderBy: { name: "asc" }, select: { id: true, name: true, dateOfBirth: true },
  });
  const ids = people.map((p) => p.id);
  const monday = mondayOf(input.date), on = parseDateOnly(input.date);
  const [held, absences, assignments, classes] = await Promise.all([
    input.requiredTypeId ? prisma.qualification.findMany({ where: { userId: { in: ids }, typeId: input.requiredTypeId }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }) : [],
    prisma.rotaAbsence.findMany({ where: { userId: { in: ids }, withdrawnAt: null, firstDay: { lte: on }, OR: [{ lastDay: null }, { lastDay: { gte: on } }] }, select: { userId: true } }),
    prisma.rotaAssignment.findMany({
      where: { userId: { in: ids }, need: { date: { gte: parseDateOnly(monday), lte: parseDateOnly(addDaysIso(monday, 6)) } } },
      select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true, type: { select: { name: true } }, site: { select: { id: true, name: true } } } } },
    }),
    commitmentsFor({ userIds: ids, from: input.date, to: input.date }).then((all) => all.filter((c) => c.source === CLASSES)),
  ]);
  const work = new Map<string, WorkItem[]>();
  const weekMinutes = new Map<string, number>();
  for (const a of assignments) {
    weekMinutes.set(a.userId, (weekMinutes.get(a.userId) ?? 0) + a.endMinutes - a.startMinutes);
    if (isoOf(a.need.date) !== input.date) continue;
    const label = a.need.site.id === input.siteId ? a.need.type.name : `${a.need.type.name} at ${a.need.site.name}`;
    work.set(a.userId, [...(work.get(a.userId) ?? []), { start: a.startMinutes, end: a.endMinutes, label }]);
  }
  for (const c of classes) if (c.userId) work.set(c.userId, [...(work.get(c.userId) ?? []), { start: c.startMinutes, end: c.endMinutes, label: `Teaching ${c.title ?? c.label}` }]);
  const young = new Map<string, YoungBand>();
  for (const p of people) { const band = youngBand(p.dateOfBirth ? isoOf(p.dateOfBirth) : null, input.date); if (band) young.set(p.id, band); }
  return rankFits({ date: input.date, start: input.start, end: input.end, requiredTypeId: input.requiredTypeId }, people.map((p) => ({ userId: p.id, name: p.name })), {
    held: held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: isoOf(q.issuedOn), expiresOn: q.expiresOn ? isoOf(q.expiresOn) : null, revoked: !!q.revokedAt })),
    work, off: new Set(absences.flatMap((a) => (a.userId ? [a.userId] : []))), weekMinutes, young,
  });
}

/** Repeating bookings at a site, running or ended in the last 30 days. */
export async function rotaRepeats(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return { who, sites, site: null, repeats: [], types: [] } as const;
  const since = parseDateOnly(addDaysIso(today(), -30));
  const [repeats, types] = await Promise.all([
    prisma.rotaRepeat.findMany({
      where: { siteId: site.id, cancelledAt: null, lastDay: { gte: since } }, orderBy: [{ firstDay: "asc" }],
      select: { id: true, kind: true, title: true, place: true, startMinutes: true, endMinutes: true, places: true, weekdays: true, firstDay: true, lastDay: true, skipDates: true,
        type: { select: { name: true, icon: true, departmentId: true } },
        needs: { where: { date: { gte: parseDateOnly(today()) } }, select: { places: true, _count: { select: { assignments: true } } } } },
    }),
    activityTypes(who.orgId ?? undefined),
  ]);
  return { who, sites, site, repeats, types: types.filter((t) => !t.fromClasses) } as const;
}


export type PlanWeek = Extract<Awaited<ReturnType<typeof planWeek>>, { site: RotaSite }>;
export type TodayAt = Extract<Awaited<ReturnType<typeof todayAt>>, { site: RotaSite }>;
export type { RotaActor };
