import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addDaysIso, mondayOf, youngBand } from "@/lib/rota/constants";
import { qualification } from "@/lib/rota/fit";
import { dayShift, type WorkItem } from "@/lib/rota/shifts";
import { commitmentsFor } from "@/modules/server";

/** The signed-in person's own days for Turnfin Me (owner decision, 6 October 2026: "their day as
 *  activities"): each day at each site, what they are on with the breaks placed for them, and
 *  the shift: the one planned for them, or the one that comes from what they are on, with the
 *  breaks the manager placed (8 October 2026). Only weeks their department has shared are shown. A day is
 *  marked changed when something of theirs was added or moved after the week was shared. */
export async function myDays(userId: string, days = 28) {
  const from = today(), to = addDaysIso(from, days - 1);
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true, dateOfBirth: true } });
  if (!me?.orgId) return [];
  const [assignments, classes, held, teaching, planned, placed] = await Promise.all([
    prisma.rotaAssignment.findMany({
      where: { userId, need: { date: range } },
      select: { startMinutes: true, endMinutes: true, createdAt: true, updatedAt: true,
        need: { select: { date: true, place: true, siteId: true, site: { select: { name: true } }, type: { select: { name: true, icon: true, departmentId: true, requiredTypeId: true, requiredType: { select: { name: true } } } } } } },
    }),
    commitmentsFor({ userIds: [userId], from, to }).then((all) => all.filter((c) => c.source === "activities.classes")),
    prisma.qualification.findMany({ where: { userId }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }),
    prisma.activityType.findFirst({ where: { orgId: me.orgId, fromClasses: true, archivedAt: null }, select: { name: true, icon: true, departmentId: true } }),
    prisma.rotaPlanShift.findMany({ where: { userId, date: range }, select: { date: true, siteId: true, departmentId: true, startMinutes: true, endMinutes: true, createdAt: true, updatedAt: true, site: { select: { name: true } } } }),
    prisma.rotaBreak.findMany({ where: { userId, date: range }, select: { date: true, siteId: true, startMinutes: true, minutes: true, paid: true } }),
  ]);
  const sites = await prisma.club.findMany({ where: { id: { in: [...new Set(classes.map((c) => c.siteId))] } }, select: { id: true, name: true } });
  const shares = await prisma.rotaWeekShare.findMany({
    where: { monday: { gte: parseDateOnly(mondayOf(from)), lte: parseDateOnly(to) }, siteId: { in: [...new Set([...assignments.map((a) => a.need.siteId), ...classes.map((c) => c.siteId), ...planned.map((p) => p.siteId)])] } },
    select: { siteId: true, departmentId: true, monday: true, sharedAt: true },
  });
  const sharedAt = (siteId: string, departmentId: string, date: string) =>
    shares.find((s) => s.siteId === siteId && s.departmentId === departmentId && s.monday.toISOString().slice(0, 10) === mondayOf(date))?.sharedAt ?? null;
  const heldList = held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: q.issuedOn.toISOString().slice(0, 10), expiresOn: q.expiresOn ? q.expiresOn.toISOString().slice(0, 10) : null, revoked: !!q.revokedAt }));

  type Item = WorkItem & { icon: string; place: string; needs: string | null; problem: "missing" | "expired" | null };
  const byDay = new Map<string, { date: string; siteId: string; site: string; items: Item[]; planned: { start: number; end: number }[]; changed: boolean }>();
  const dayOf = (date: string, siteId: string, site: string) => {
    const key = `${date}|${siteId}`;
    if (!byDay.has(key)) byDay.set(key, { date, siteId, site, items: [], planned: [], changed: false });
    return byDay.get(key)!;
  };
  for (const a of assignments) {
    const date = a.need.date.toISOString().slice(0, 10);
    const shared = sharedAt(a.need.siteId, a.need.type.departmentId, date);
    if (!shared) continue;
    const d = dayOf(date, a.need.siteId, a.need.site.name);
    const q = qualification(heldList, userId, a.need.type.requiredTypeId, date);
    d.items.push({ start: a.startMinutes, end: a.endMinutes, label: a.need.type.name, icon: a.need.type.icon, place: a.need.place, needs: a.need.type.requiredType?.name ?? null, problem: q === "ok" ? null : q });
    if (a.updatedAt > shared || a.createdAt > shared) d.changed = true;
  }
  for (const c of classes) {
    if (!teaching || !sharedAt(c.siteId, teaching.departmentId, c.date)) continue;
    const d = dayOf(c.date, c.siteId, sites.find((s) => s.id === c.siteId)?.name ?? "");
    d.items.push({ start: c.startMinutes, end: c.endMinutes, label: `${teaching.name}: ${c.title ?? c.label}`, icon: teaching.icon, place: c.place ?? "", needs: null, problem: null });
  }
  for (const p of planned) {
    const date = p.date.toISOString().slice(0, 10);
    const shared = sharedAt(p.siteId, p.departmentId, date);
    if (!shared) continue;
    const d = dayOf(date, p.siteId, p.site.name);
    d.planned.push({ start: p.startMinutes, end: p.endMinutes });
    if (p.updatedAt > shared || p.createdAt > shared) d.changed = true;
  }
  const dob = me.dateOfBirth ? me.dateOfBirth.toISOString().slice(0, 10) : null;
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date) || a.site.localeCompare(b.site)).map((d) => {
    const pinned = placed.filter((b) => b.siteId === d.siteId && b.date.toISOString().slice(0, 10) === d.date).map((b) => ({ start: b.startMinutes, minutes: b.minutes, paid: b.paid }));
    const shift = dayShift(d.items, youngBand(dob, d.date), { planned: d.planned, pinned })!;
    return { ...d, items: d.items.sort((a, b) => a.start - b.start), shift };
  });
}
export type MyDay = Awaited<ReturnType<typeof myDays>>[number];
