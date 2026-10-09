import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { addDaysIso } from "@/modules/rota/shared/constants";
import { activityTypes, pickSite } from "@/modules/rota/shared/data";

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
