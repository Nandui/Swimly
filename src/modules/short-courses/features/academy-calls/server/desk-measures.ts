import "server-only";
import type { DeskMeasure, DeskMeasureQuery } from "@/modules/contributions";
import { prisma } from "@/lib/prisma";

/** The Academy's call backs for the swim school's reception analytics (`registerDeskMeasures`): each place
 *  held online waits for a phone call to take payment within 72 hours (`callBy`). Done is the first call
 *  logged, by whoever made it; still waiting is a booked place nobody has phoned yet. */
export async function academyCallBacks(query: DeskMeasureQuery): Promise<DeskMeasure[]> {
  if (query.siteIds?.length === 0) return [];
  const from = new Date(`${query.from}T00:00:00Z`), to = new Date(`${query.to}T23:59:59Z`);
  const rows = await prisma.academyCandidate.findMany({
    where: {
      callBy: { not: null },
      ...(query.siteIds ? { course: { siteId: { in: [...query.siteIds] } } } : {}),
      OR: [
        { calls: { some: { createdAt: { gte: from, lte: to } } } },
        { status: "booked", calls: { none: {} } },
      ],
    },
    select: { createdAt: true, callBy: true, status: true, course: { select: { siteId: true } }, calls: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true, byId: true, byName: true } } },
  });
  const minutes = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
  return rows.flatMap((row): DeskMeasure[] => {
    const first = row.calls[0];
    const base = { kind: "academy.call-back", label: "Academy call backs", module: "Short courses", siteId: row.course.siteId };
    if (first) {
      if (first.createdAt < from || first.createdAt > to) return [];
      return [{ ...base, userId: first.byId, userName: first.byName, at: first.createdAt.toISOString(), minutes: minutes(row.createdAt, first.createdAt), onTime: first.createdAt <= row.callBy!, open: false }];
    }
    return [{ ...base, userId: null, userName: null, at: row.createdAt.toISOString(), minutes: minutes(row.createdAt, query.now), onTime: query.now <= row.callBy! ? null : false, open: true }];
  });
}
