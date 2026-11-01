import "server-only";
import { activePlacedStaff, activeStaffAtSite, staffByIds } from "@/lib/directory";
import { qualificationsHeldBy, qualificationTypesOf } from "@/lib/qualifications";
import { prisma } from "@/lib/prisma";
import { commitmentsFor } from "@/modules/contributions";
import type { ClassItem, DutyRef, SessionDef, Shift } from "@/modules/plan/shared/model";

/** What Plan (test) reads for one site over some days, for the Week and Day screens: the setup,
 *  what's on, the shifts, who is off, the classes from other apps and who holds which
 *  qualification. Everything else is worked out by the pure model. */

export type PlanDutyRow = DutyRef & { color: string; defaultMinutes: number | null; forClasses: boolean; tasks: { name: string; when: string; atMinutes: number | null }[] };
export type PlanAreaRow = { id: string; name: string; parentId: string | null; lanes: number; departmentId: string | null };
export type PlanPerson = { id: string; name: string; departmentIds: string[] };

/** The organisation's duties, live ones only, in name order (breaks last). */
export async function dutiesOf(orgId: string): Promise<PlanDutyRow[]> {
  const rows = await prisma.planDuty.findMany({
    where: { orgId, archivedAt: null }, orderBy: [{ isBreak: "asc" }, { name: "asc" }],
    include: { tasks: { orderBy: [{ sortOrder: "asc" }] } },
  });
  return rows.map((d) => ({ id: d.id, name: d.name, qualificationTypeId: d.qualificationTypeId, isBreak: d.isBreak, departmentId: d.departmentId,
    color: d.color, defaultMinutes: d.defaultMinutes, forClasses: d.forClasses, tasks: d.tasks.map((t) => ({ name: t.name, when: t.when, atMinutes: t.atMinutes })) }));
}

/** A site's live areas, wholes first then their parts, each in order. */
export async function areasOf(orgId: string, siteId: string): Promise<PlanAreaRow[]> {
  const rows = await prisma.planArea.findMany({ where: { orgId, siteId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, parentId: true, lanes: true, departmentId: true } });
  const wholes = rows.filter((a) => !a.parentId);
  return wholes.flatMap((w) => [w, ...rows.filter((p) => p.parentId === w.id)]);
}

/** A site's sessions that run on any day from `from` to `to`, not called off. */
export async function sessionsOf(orgId: string, siteId: string, from: string, to: string) {
  const rows = await prisma.planSession.findMany({
    where: { orgId, siteId, cancelledAt: null, firstDay: { lte: to }, lastDay: { gte: from } },
    orderBy: [{ startMinutes: "asc" }, { title: "asc" }],
    include: { needs: true, days: { where: { date: { gte: from, lte: to } } } },
  });
  return rows.map((s) => ({
    id: s.id, title: s.title, areaId: s.areaId, lanes: s.lanes, start: s.startMinutes, end: s.endMinutes, weekdays: s.weekdays,
    firstDay: s.firstDay, lastDay: s.lastDay, skipDays: s.skipDays, note: s.note,
    needs: s.needs.map((n) => ({ dutyId: n.dutyId, count: n.count })),
    days: s.days.map((d) => ({ date: d.date, cancelled: d.cancelled, start: d.startMinutes, end: d.endMinutes })),
  })) satisfies (SessionDef & { note: string })[];
}

const shiftRow = (s: { id: string; userId: string; departmentId: string; siteId: string; date: string; startMinutes: number; endMinutes: number; note: string;
  blocks: { id: string; shiftId: string; dutyId: string; sessionId: string | null; startMinutes: number; endMinutes: number }[] }) => ({
  id: s.id, userId: s.userId, departmentId: s.departmentId, siteId: s.siteId, date: s.date, start: s.startMinutes, end: s.endMinutes, note: s.note,
  blocks: s.blocks.map((b) => ({ id: b.id, shiftId: b.shiftId, dutyId: b.dutyId, sessionId: b.sessionId, start: b.startMinutes, end: b.endMinutes })),
}) satisfies Shift & { note: string };

/** The shifts at a site from `from` to `to`, with their blocks. */
export async function shiftsAt(orgId: string, siteId: string, from: string, to: string) {
  const rows = await prisma.planShift.findMany({
    where: { orgId, siteId, date: { gte: from, lte: to } }, orderBy: [{ date: "asc" }, { startMinutes: "asc" }],
    include: { blocks: { orderBy: { startMinutes: "asc" } } },
  });
  return rows.map(shiftRow);
}

/** These people's shifts at other sites from `from` to `to` (for overlaps). */
export async function shiftsElsewhere(orgId: string, siteId: string, userIds: readonly string[], from: string, to: string) {
  if (!userIds.length) return [];
  const rows = await prisma.planShift.findMany({
    where: { orgId, siteId: { not: siteId }, userId: { in: [...userIds] }, date: { gte: from, lte: to } },
    include: { blocks: true },
  });
  return rows.map(shiftRow);
}

/** Who is marked off on any day from `from` to `to`. */
export async function offsBetween(orgId: string, from: string, to: string, userIds?: readonly string[]) {
  return prisma.planOff.findMany({
    where: { orgId, withdrawnAt: null, firstDay: { lte: to }, lastDay: { gte: from }, ...(userIds ? { userId: { in: [...userIds] } } : {}) },
    orderBy: { firstDay: "asc" }, select: { id: true, userId: true, firstDay: true, lastDay: true, reason: true, note: true },
  });
}

/** Classes and other apps' commitments at the site, day by day (and these people's elsewhere,
 *  for clashes). A commitment with its own id can have its teacher planned from here. */
export async function classesAt(siteId: string, userIds: readonly string[], from: string, to: string) {
  const [here, theirs] = await Promise.all([
    commitmentsFor({ siteIds: [siteId], from, to }),
    userIds.length ? commitmentsFor({ userIds: [...userIds], from, to }) : Promise.resolve([]),
  ]);
  const item = (c: (typeof here)[number]): ClassItem & { date: string; siteId: string } => ({
    ref: c.ref ?? `${c.source}:${c.date}:${c.startMinutes}:${c.label}`, source: c.source, title: c.label, place: c.place ?? "",
    start: c.startMinutes, end: c.endMinutes, userId: c.userId, plannable: Boolean(c.ref), date: c.date, siteId: c.siteId,
  });
  const atSite = here.map(item);
  const seen = new Set(atSite.map((c) => `${c.source}|${c.ref}|${c.date}`));
  return { atSite, all: [...atSite, ...theirs.map(item).filter((c) => !seen.has(`${c.source}|${c.ref}|${c.date}`))] };
}

/** Whether a person holds a qualification on a day: issued by then, not expired, not revoked. */
export async function heldOn(userIds: readonly string[]) {
  const rows = await qualificationsHeldBy(userIds);
  const iso = (d: Date | null) => d ? d.toISOString().slice(0, 10) : null;
  return (userId: string, typeId: string, date: string) => rows.some((q) => q.userId === userId && q.typeId === typeId && !q.revokedAt
    && (iso(q.issuedOn) ?? "") <= date && (q.expiresOn === null || (iso(q.expiresOn) ?? "") >= date));
}

/** The people who can be put on a shift at a site: everyone who works there, with their
 *  departments, plus anyone already planned there. */
export async function peopleFor(orgId: string, siteId: string, alsoIds: readonly string[]): Promise<PlanPerson[]> {
  const atSite = await activeStaffAtSite(orgId, siteId);
  const ids = [...new Set([...atSite.map((p) => p.id), ...alsoIds])];
  const [placed, names] = await Promise.all([activePlacedStaff(orgId, { kind: "some", userIds: new Set(ids) }), staffByIds(ids)]);
  const departments = new Map(placed.map((p) => [p.id, p.departmentIds]));
  return ids.map((id) => ({ id, name: names.get(id)?.name ?? "Someone who has left", departmentIds: departments.get(id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The organisation's qualification names, for warnings and the duty form. */
export async function qualificationNames(orgId: string) {
  return new Map((await qualificationTypesOf(orgId)).map((q) => [q.id, q.name]));
}
