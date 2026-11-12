import "server-only";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { activityTypesByIds } from "@/lib/setup/activity-types";
import { addDaysIso, BOOKING_KINDS, type BookingKind } from "@/modules/rota/shared/constants";
import { activityTypes, pickSite } from "@/modules/rota/shared/data";

/** Repeating bookings at a site, running or ended in the last 30 days. */
export async function rotaRepeats(siteId: string | undefined) {
  const { who, sites, site } = await pickSite(siteId);
  if (!site) return { who, sites, site: null, repeats: [], types: [], kindStaff: kindDefaults([]) } as const;
  const since = parseDateOnly(addDaysIso(today(), -30));
  const [found, types, kinds] = await Promise.all([
    prisma.rotaRepeat.findMany({
      where: { siteId: site.id, cancelledAt: null, lastDay: { gte: since } }, orderBy: [{ firstDay: "asc" }],
      select: { id: true, kind: true, title: true, place: true, lanes: true, startMinutes: true, endMinutes: true, places: true, weekdays: true, firstDay: true, lastDay: true, skipDates: true,
        typeId: true,
        needs: { where: { date: { gte: parseDateOnly(today()) } }, select: { places: true, _count: { select: { assignments: true } } } } },
    }),
    activityTypes(who.orgId ?? undefined),
    who.orgId ? prisma.rotaBookingKind.findMany({ where: { orgId: who.orgId }, select: { kind: true, staff: true } }) : [],
  ]);
  const listed = await activityTypesByIds(found.map((r) => r.typeId));
  const repeats = found.map(({ typeId, ...r }) => {
    const type = listed.get(typeId);
    return { ...r, typeId, type: { name: type?.name ?? "Removed activity", icon: type?.icon ?? "activity", departmentId: type?.departmentId ?? "" } };
  });
  return { who, sites, site, repeats, types: types.filter((t) => !t.fromClasses), kindStaff: kindDefaults(kinds) } as const;
}

/** Staff each kind of booking needs: one unless set (owner, 20 October 2026). */
function kindDefaults(rows: readonly { kind: string; staff: number }[]) {
  return Object.fromEntries(BOOKING_KINDS.map((k) => [k, rows.find((r) => r.kind === k)?.staff ?? 1])) as Record<BookingKind, number>;
}
