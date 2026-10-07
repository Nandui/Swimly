import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addDaysIso, mondayOf, youngBand } from "@/lib/rota/constants";
import { qualification } from "@/lib/rota/fit";
import { dayShift, type WorkItem } from "@/lib/rota/shifts";
import { commitmentsFor } from "@/modules/server";

/** The signed-in person's own days for Turnfin Me (owner decision, 6 October 2026: "their day as
 *  activities"): each day at each site, what they are on with the breaks placed for them, and
 *  the shift that comes from it. Only weeks their department has shared are shown. A day is
 *  marked changed when something of theirs was added or moved after the week was shared. */
export async function myDays(userId: string, days = 28) {
  const from = today(), to = addDaysIso(from, days - 1);
  const range = { gte: parseDateOnly(from), lte: parseDateOnly(to) };
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { orgId: true, dateOfBirth: true } });
  if (!me?.orgId) return [];
  const [assignments, classes, held, teaching] = await Promise.all([
    prisma.rotaAssignment.findMany({
      where: { userId, need: { date: range } },
      select: { startMinutes: true, endMinutes: true, createdAt: true, updatedAt: true,
        need: { select: { date: true, place: true, siteId: true, site: { select: { name: true } }, type: { select: { name: true, icon: true, departmentId: true, requiredTypeId: true, requiredType: { select: { name: true } } } } } } },
    }),
    commitmentsFor({ userIds: [userId], from, to }).then((all) => all.filter((c) => c.source === "activities.classes")),
    prisma.qualification.findMany({ where: { userId }, select: { userId: true, typeId: true, issuedOn: true, expiresOn: true, revokedAt: true } }),
    prisma.activityType.findFirst({ where: { orgId: me.orgId, fromClasses: true, archivedAt: null }, select: { name: true, icon: true, departmentId: true } }),
  ]);
  const sites = await prisma.club.findMany({ where: { id: { in: [...new Set(classes.map((c) => c.siteId))] } }, select: { id: true, name: true } });
  const shares = await prisma.rotaWeekShare.findMany({
    where: { monday: { gte: parseDateOnly(mondayOf(from)), lte: parseDateOnly(to) }, siteId: { in: [...new Set([...assignments.map((a) => a.need.siteId), ...classes.map((c) => c.siteId)])] } },
    select: { siteId: true, departmentId: true, monday: true, sharedAt: true },
  });
  const sharedAt = (siteId: string, departmentId: string, date: string) =>
    shares.find((s) => s.siteId === siteId && s.departmentId === departmentId && s.monday.toISOString().slice(0, 10) === mondayOf(date))?.sharedAt ?? null;
  const heldList = held.map((q) => ({ userId: q.userId, typeId: q.typeId, issuedOn: q.issuedOn.toISOString().slice(0, 10), expiresOn: q.expiresOn ? q.expiresOn.toISOString().slice(0, 10) : null, revoked: !!q.revokedAt }));

  type Item = WorkItem & { icon: string; place: string; needs: string | null; problem: "missing" | "expired" | null };
  const byDay = new Map<string, { date: string; siteId: string; site: string; items: Item[]; changed: boolean }>();
  const dayOf = (date: string, siteId: string, site: string) => {
    const key = `${date}|${siteId}`;
    if (!byDay.has(key)) byDay.set(key, { date, siteId, site, items: [], changed: false });
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
  const dob = me.dateOfBirth ? me.dateOfBirth.toISOString().slice(0, 10) : null;
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date) || a.site.localeCompare(b.site)).map((d) => {
    const shift = dayShift(d.items, youngBand(dob, d.date))!;
    return { ...d, items: d.items.sort((a, b) => a.start - b.start), shift };
  });
}
export type MyDay = Awaited<ReturnType<typeof myDays>>[number];
