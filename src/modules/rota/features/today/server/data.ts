import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { buildDay } from "@/modules/rota/shared/day";
import { type RotaSite, loadDays, pickSite } from "@/modules/rota/shared/data";

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
export type TodayAt = Extract<Awaited<ReturnType<typeof todayAt>>, { site: RotaSite }>;
