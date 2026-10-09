import "server-only";
import { activeStaffAgesAtSite, liveSitesWithin, sitesByIds, staffAgesByIds } from "@/lib/directory";
import { qualificationsHeldBy } from "@/lib/qualifications";
import { activityTypesByIds, activityTypesOf } from "@/lib/setup/activity-types";
import { areaNames } from "@/lib/setup/data";
import { notFound } from "next/navigation";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { requireRotaActor, type RotaActor } from "@/modules/rota/shared/access";
import { addDaysIso, mondayOf, youngBand, youngRest, type YoungBand } from "@/modules/rota/shared/constants";
import { type DayBooked, type DayClass, type DayType } from "@/modules/rota/shared/day";
import { rankFits, type Held } from "@/modules/rota/shared/fit";
import type { PinnedBreak, WorkItem } from "@/modules/rota/shared/shifts";
import { commitmentsFor } from "@/modules/server";

/** Rota reads (owner decisions, 6 October 2026). The sites a person may see come from the policy
 *  engine; a site outside them is a 404, never an empty rota. Every day is laid out by
 *  `buildDay`, so Plan, Today and Turnfin Me agree. */

export const isoOf = (d: Date) => d.toISOString().slice(0, 10);
export const CLASSES = "activities.classes";

export async function rotaSites() {
  const who = await requireRotaActor();
  const [view, plan, run] = await Promise.all([sitesFor("rota.view"), who.plan ? sitesFor("rota.plan") : null, who.run ? sitesFor("rota.manage") : null]);
  const sites = await liveSitesWithin(who.orgId ?? null, view);
  const holds = (s: Awaited<ReturnType<typeof sitesFor>> | null, id: string) => !!s && (s.kind === "all" || s.siteIds.has(id));
  return { who, sites: sites.map((s) => ({ ...s, plan: holds(plan, s.id) || holds(run, s.id), run: holds(run, s.id) })) };
}
export type RotaSite = Awaited<ReturnType<typeof rotaSites>>["sites"][number];

export async function pickSite(siteId: string | undefined) {
  const { who, sites } = await rotaSites();
  const site = siteId ? sites.find((s) => s.id === siteId) : sites[0];
  if (siteId && !site) notFound();
  return { who, sites, site: site ?? null };
}

/** The organisation's activity list, as `buildDay` takes it. */
export async function activityTypes(orgId: string | undefined, includeArchived = false): Promise<(DayType & { archived: boolean; departmentName: string })[]> {
  const rows = await activityTypesOf(orgId ?? null, includeArchived);
  return rows.map((r) => ({ id: r.id, name: r.name, icon: r.icon, departmentId: r.departmentId, departmentName: r.department.name, requiredTypeId: r.requiredTypeId,
    requiredName: r.requiredType?.name ?? null, fromClasses: r.fromClasses, archived: !!r.archivedAt }));
}

/** Adds each assignment's activity and site, by name, from Core. */
export async function withNeedNames<T extends { need: { date: Date; typeId: string; siteId: string } }>(rows: T[]) {
  const [types, sites] = await Promise.all([activityTypesByIds(rows.map((r) => r.need.typeId)), sitesByIds(rows.map((r) => r.need.siteId))]);
  return rows.map((row) => ({ ...row, need: { ...row.need,
    type: { name: types.get(row.need.typeId)?.name ?? "Removed activity" },
    site: { id: row.need.siteId, name: sites.get(row.need.siteId)?.name ?? "Removed site" } } }));
}

/** Everything `buildDay` needs for each day from `from` to `to` at one site. */
export async function loadDays(siteId: string, orgId: string | undefined, from: string, to: string) {
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  const [types, needs, siteCommitments, planned, pinned] = await Promise.all([
    activityTypes(orgId, true),
    prisma.rotaNeed.findMany({
      where: { siteId, date: range }, orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
      select: { id: true, date: true, typeId: true, place: true, startMinutes: true, endMinutes: true, places: true, note: true, repeat: { select: { title: true } },
        assignments: { select: { id: true, needId: true, place: true, userId: true, startMinutes: true, endMinutes: true } } },
    }),
    commitmentsFor({ siteIds: [siteId], from, to }),
    prisma.rotaPlanShift.findMany({ where: { siteId, date: range }, select: { id: true, date: true, userId: true, departmentId: true, startMinutes: true, endMinutes: true } }),
    prisma.rotaBreak.findMany({ where: { siteId, date: range }, orderBy: { startMinutes: "asc" }, select: { date: true, userId: true, startMinutes: true, minutes: true, paid: true } }),
  ]);
  // Swim classes are Teaching; anything else another module reports here (Academy sessions) is
  // drawn in its area, planned there.
  const classes = siteCommitments.filter((c) => c.source === CLASSES);
  const others = siteCommitments.filter((c) => c.source !== CLASSES);
  const userIds = [...new Set([...needs.flatMap((n) => n.assignments.map((a) => a.userId)), ...siteCommitments.flatMap((c) => (c.userId ? [c.userId] : [])), ...planned.map((p) => p.userId)])];
  const [users, held, absences, elsewhere, elsewhereClasses] = userIds.length ? await Promise.all([
    staffAgesByIds(userIds),
    qualificationsHeldBy(userIds),
    prisma.rotaAbsence.findMany({
      where: { userId: { in: userIds }, withdrawnAt: null, firstDay: { lte: parseDateOnly(to) }, OR: [{ lastDay: null }, { lastDay: { gte: parseDateOnly(from) } }] },
      select: { userId: true, firstDay: true, lastDay: true },
    }),
    // The same people on activities at other sites, for double bookings.
    prisma.rotaAssignment.findMany({
      where: { userId: { in: userIds }, need: { siteId: { not: siteId }, date: range } },
      select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true, typeId: true, siteId: true } } },
    }).then(withNeedNames),
    commitmentsFor({ userIds, from, to }).then((all) => all.filter((c) => c.siteId !== siteId)),
  ]) : [[], [], [], [], []];
  const names = new Map(users.map((u) => [u.id, u.name]));
  const rest = await youngDays(users, from, to);
  const heldList: Held[] = held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: q.issuedOn ? isoOf(q.issuedOn) : null, expiresOn: q.expiresOn ? isoOf(q.expiresOn) : null, revoked: !!q.revokedAt }));
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
      booked: others.filter((c) => c.date === date).map((c): DayBooked => ({ ref: c.ref ?? `${c.source}:${c.startMinutes}`, userId: c.userId, startMinutes: c.startMinutes, endMinutes: c.endMinutes,
        title: c.title ?? c.label, place: c.place ?? "", href: c.href ?? null })),
      classes: classes.filter((c) => c.date === date && c.ref).map((c): DayClass => ({ ref: c.ref!, userId: c.userId, startMinutes: c.startMinutes, endMinutes: c.endMinutes,
        title: c.title ?? c.label, place: c.place ?? "", planned: !!c.planned })),
    };
  };
  return { types, dayInput, places };
}

/** For the under-18s among these people: each day they work, at any site, from the day before
 *  `from` to the end of the week after `to`, with its first start and last finish, for their
 *  rest warnings (`youngRest`). Rota activities, planned shifts and swim classes count. */
export async function youngDays(users: readonly { id: string; dateOfBirth: Date | null }[], from: string, to: string) {
  const ids = users.filter((u) => youngBand(u.dateOfBirth ? isoOf(u.dateOfBirth) : null, to) || youngBand(u.dateOfBirth ? isoOf(u.dateOfBirth) : null, from)).map((u) => u.id);
  const out = new Map<string, Map<string, { start: number; end: number }>>();
  if (!ids.length) return out;
  const first = addDaysIso(mondayOf(from), -1), last = addDaysIso(mondayOf(to), 7);
  const range = { gte: parseDateOnly(first), lte: parseDateOnly(last) };
  const [assigned, shifts, classes] = await Promise.all([
    prisma.rotaAssignment.findMany({ where: { userId: { in: ids }, need: { date: range } }, select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true } } } }),
    prisma.rotaPlanShift.findMany({ where: { userId: { in: ids }, date: range }, select: { userId: true, date: true, startMinutes: true, endMinutes: true } }),
    commitmentsFor({ userIds: ids, from: first, to: last }),
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

/** "Who can fill it" for one gap: everyone who works at the site, best fit first. */
export async function fitsFor(input: { siteId: string; date: string; start: number; end: number; requiredTypeId: string | null }) {
  const who = await requireRotaActor();
  const orgId = who.orgId ?? undefined;
  if (!(await mayFor("rota.view", { siteId: input.siteId, orgId }))) return [];
  const people = await activeStaffAgesAtSite(orgId ?? null, input.siteId);
  const ids = people.map((p) => p.id);
  const monday = mondayOf(input.date), on = parseDateOnly(input.date);
  const [held, absences, assignments, classes] = await Promise.all([
    input.requiredTypeId ? qualificationsHeldBy(ids, input.requiredTypeId) : [],
    prisma.rotaAbsence.findMany({ where: { userId: { in: ids }, withdrawnAt: null, firstDay: { lte: on }, OR: [{ lastDay: null }, { lastDay: { gte: on } }] }, select: { userId: true } }),
    prisma.rotaAssignment.findMany({
      where: { userId: { in: ids }, need: { date: { gte: parseDateOnly(monday), lte: parseDateOnly(addDaysIso(monday, 6)) } } },
      select: { userId: true, startMinutes: true, endMinutes: true, need: { select: { date: true, typeId: true, siteId: true } } },
    }).then(withNeedNames),
    commitmentsFor({ userIds: ids, from: input.date, to: input.date }),
  ]);
  const work = new Map<string, WorkItem[]>();
  const weekMinutes = new Map<string, number>();
  for (const a of assignments) {
    weekMinutes.set(a.userId, (weekMinutes.get(a.userId) ?? 0) + a.endMinutes - a.startMinutes);
    if (isoOf(a.need.date) !== input.date) continue;
    const label = a.need.site.id === input.siteId ? a.need.type.name : `${a.need.type.name} at ${a.need.site.name}`;
    work.set(a.userId, [...(work.get(a.userId) ?? []), { start: a.startMinutes, end: a.endMinutes, label }]);
  }
  for (const c of classes) if (c.userId) work.set(c.userId, [...(work.get(c.userId) ?? []), { start: c.startMinutes, end: c.endMinutes, label: c.source === CLASSES ? `Teaching ${c.title ?? c.label}` : c.label }]);
  const young = new Map<string, YoungBand>();
  for (const p of people) { const band = youngBand(p.dateOfBirth ? isoOf(p.dateOfBirth) : null, input.date); if (band) young.set(p.id, band); }
  return rankFits({ date: input.date, start: input.start, end: input.end, requiredTypeId: input.requiredTypeId }, people.map((p) => ({ userId: p.id, name: p.name })), {
    held: held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: q.issuedOn ? isoOf(q.issuedOn) : null, expiresOn: q.expiresOn ? isoOf(q.expiresOn) : null, revoked: !!q.revokedAt })),
    work, off: new Set(absences.flatMap((a) => (a.userId ? [a.userId] : []))), weekMinutes, young,
  });
}
export type { RotaActor };
