import type { Prisma } from "@/generated/prisma/client";
import { subTimes } from "@/lib/setup/meta";

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

/** The ids of a department's activities, archived ones too unless `liveOnly`. */
export async function activityTypeIdsIn(departmentId: string, opts: { liveOnly?: boolean } = {}, db?: Db): Promise<string[]> {
  const rows = await (await client(db)).activityType.findMany({ where: { departmentId, ...(opts.liveOnly ? { archivedAt: null } : {}) }, select: { id: true } });
  return rows.map((row) => row.id);
}

/** `at` is its first set time, `times` all of them (empty unless `when` is "at"). */
export type SubActivityRef = { id: string; name: string; when: string; at: number | null; times: number[]; usual: boolean };

/** Each activity's open sub-activities (Admin, Activities; owner, 20 October 2026), in order,
 *  by activity id: the smaller jobs done by whoever is on it, such as opening the cash till.
 *  `usualOnly` keeps the ones that come with the activity when someone is put on it. */
export async function subActivitiesFor(typeIds: readonly (string | null | undefined)[], opts: { usualOnly?: boolean } = {}): Promise<Record<string, SubActivityRef[]>> {
  const wanted = [...new Set(typeIds.filter((id): id is string => Boolean(id)))];
  const out: Record<string, SubActivityRef[]> = {};
  if (wanted.length === 0) return out;
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.subActivity.findMany({
    where: { activityTypeId: { in: wanted }, archivedAt: null, ...(opts.usualOnly ? { usual: true } : {}) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, activityTypeId: true, name: true, when: true, atMinutes: true, times: true, usual: true },
  });
  for (const r of rows) {
    const times = r.when === "at" ? subTimes(r) : [];
    (out[r.activityTypeId] ??= []).push({ id: r.id, name: r.name, when: r.when, at: times[0] ?? null, times, usual: r.usual });
  }
  return out;
}
