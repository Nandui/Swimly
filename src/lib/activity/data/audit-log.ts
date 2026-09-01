import type { Prisma } from "@/generated/prisma/client";
import { requirePermission, requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** `as const satisfies` — both, in that order. `satisfies` alone widens `true`
 *  to `boolean` and `GetPayload` stops being able to tell which fields were
 *  picked; `as const` alone lets a typo through until the query runs. */
const SELECT = {
  id: true,
  actorName: true,
  action: true,
  entity: true,
  summary: true,
  createdAt: true,
} as const satisfies Prisma.AuditLogSelect;

export type ActivityEntry = Prisma.AuditLogGetPayload<{ select: typeof SELECT }>;

/** The tail of the trail, for the overview. */
export async function getRecentActivity(take = 8): Promise<ActivityEntry[]> {
  await requireSession();
  return prisma.auditLog.findMany({
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** How many entries a page of the trail holds. It used to be the 200 newest in
 *  one go — 441KB of page for a table nobody reads past the first screen of,
 *  and growing with every register taken. */
export const ACTIVITY_PER_PAGE = 50;

/** The whole trail, a page at a time. Needs `activity.view`: the log names who
 *  did what, which is a different question from what the data currently says. */
export async function getActivity(page = 1) {
  await requirePermission("activity.view");
  const current = Math.max(1, Math.trunc(page));

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      select: SELECT,
      orderBy: { createdAt: "desc" },
      skip: (current - 1) * ACTIVITY_PER_PAGE,
      take: ACTIVITY_PER_PAGE,
    }),
    prisma.auditLog.count(),
  ]);

  return { entries, total, page: current };
}
