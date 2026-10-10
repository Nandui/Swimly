import type { Prisma } from "@/generated/prisma/client";

/** Core's activity list (Admin, Activities; kept there since 7 October 2026 so every module
 *  uses the same list): what the rota plans and covers, each with the department that plans
 *  it, its icon and the qualification it needs. Modules read it here and keep only the ids.
 *  Pass a transaction client to read inside one. */

type Db = Pick<Prisma.TransactionClient, "activityType">;
async function client(db?: Db): Promise<Db> {
  return db ?? (await import("@/lib/prisma")).prisma;
}

export type ActivityTypeRef = {
  id: string; orgId: string; name: string; icon: string; departmentId: string; requiredTypeId: string | null; fromClasses: boolean; archivedAt: Date | null;
};
const select = { id: true, orgId: true, name: true, icon: true, departmentId: true, requiredTypeId: true, fromClasses: true, archivedAt: true } as const;

/** An organisation's activities in order, archived ones too when asked, with their department's
 *  name and the name of the qualification each needs. */
export async function activityTypesOf(orgId: string | null, includeArchived = false, db?: Db) {
  return (await client(db)).activityType.findMany({
    where: { orgId: orgId ?? undefined, ...(includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { ...select, requiredType: { select: { name: true } }, department: { select: { name: true } } },
  });
}

/** One activity, archived or not; null when there is none. */
export async function activityTypeById(id: string, db?: Db): Promise<ActivityTypeRef | null> {
  return (await client(db)).activityType.findFirst({ where: { id }, select });
}

export async function activityTypesByIds(ids: readonly (string | null | undefined)[], db?: Db): Promise<Map<string, ActivityTypeRef>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const rows = await (await client(db)).activityType.findMany({ where: { id: { in: wanted } }, select });
  return new Map(rows.map((row) => [row.id, row]));
}

/** The activity that swim classes arrive as (one per organisation): the live one, or any when
 *  `liveOnly` is false; narrowed to a department when one is given. Null when there is none. */
export async function classesActivity(orgId: string | null, opts: { departmentId?: string; liveOnly?: boolean } = {}, db?: Db): Promise<ActivityTypeRef | null> {
  return (await client(db)).activityType.findFirst({
    where: { orgId: orgId ?? undefined, fromClasses: true, ...(opts.liveOnly === false ? {} : { archivedAt: null }), ...(opts.departmentId ? { departmentId: opts.departmentId } : {}) },
    select,
  });
}

/** The ids of a department's activities, archived ones too unless `liveOnly`. */
export async function activityTypeIdsIn(departmentId: string, opts: { liveOnly?: boolean } = {}, db?: Db): Promise<string[]> {
  const rows = await (await client(db)).activityType.findMany({ where: { departmentId, ...(opts.liveOnly ? { archivedAt: null } : {}) }, select: { id: true } });
  return rows.map((row) => row.id);
}
