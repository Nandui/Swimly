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

/** The whole trail. Admin-only: the log names who did what, which is a
 *  different question from what the data currently says. */
export async function getActivity(take = 200): Promise<ActivityEntry[]> {
  await requirePermission("activity.view");
  return prisma.auditLog.findMany({
    select: SELECT,
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function countActivity(): Promise<number> {
  await requireSession();
  return prisma.auditLog.count();
}
