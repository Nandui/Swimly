import type { Prisma } from "@/generated/prisma/client";
import { ADMINISTRATOR_PERMISSIONS } from "@/lib/staff/permissions";

/** Core's directory of people and sites, for modules.
 *
 *  Modules keep only IDs of Core records (an instructor's user id, a class's
 *  site id) and ask here for the names, instead of joining Core tables in
 *  their own queries. That keeps each module's data separable: when
 *  Activities moves to its own database or app, only this file becomes an
 *  API call. Pass a transaction client to read inside one.
 *
 *  Reads here are deliberately minimal (id, name and whether a site is
 *  archived) and carry no permissions; callers have already checked theirs. */

export type StaffRef = { id: string; name: string };
export type SiteRef = { id: string; name: string };
/** A site with whether it is archived, for callers that filter or label on it. */
export type SiteStatusRef = SiteRef & { archivedAt: Date | null };

type Db = Pick<Prisma.TransactionClient, "user" | "club">;

/** The app's client, loaded only when a caller did not pass one, so code that
 *  always passes its own transaction (such as the parent API) never needs it. */
async function client(db?: Db): Promise<Db> {
  return db ?? (await import("@/lib/prisma")).prisma;
}

const unique = (ids: readonly (string | null | undefined)[]) => [...new Set(ids.filter((id): id is string => Boolean(id)))];

export async function staffByIds(ids: readonly (string | null | undefined)[], db?: Db): Promise<Map<string, StaffRef>> {
  const wanted = unique(ids);
  if (wanted.length === 0) return new Map();
  const rows = await (await client(db)).user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
  return new Map(rows.map((row) => [row.id, row]));
}

export async function sitesByIds(ids: readonly (string | null | undefined)[], db?: Db): Promise<Map<string, SiteStatusRef>> {
  const wanted = unique(ids);
  if (wanted.length === 0) return new Map();
  const rows = await (await client(db)).club.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true, archivedAt: true } });
  return new Map(rows.map((row) => [row.id, row]));
}

/** Whether this site is archived (or no longer exists). Read inside a module's
 *  transaction so the check and the write see the same data. */
export async function isArchivedSite(id: string, db?: Db): Promise<boolean> {
  const site = await (await client(db)).club.findUnique({ where: { id }, select: { archivedAt: true } });
  return !site || site.archivedAt !== null;
}

/** Whether this is an active staff account, e.g. before naming them a class's instructor. */
export async function isActiveStaff(id: string, db?: Db): Promise<boolean> {
  return Boolean(await (await client(db)).user.findUnique({ where: { id, isActive: true }, select: { id: true } }));
}

/** Active staff whose role holds any of these permissions, or administrator
 *  access, by name. Asked by permission, never by role name. */
export async function activeStaffHolding(permissions: readonly string[], db?: Db): Promise<StaffRef[]> {
  return (await client(db)).user.findMany({
    where: {
      isActive: true,
      staffRole: { OR: [
        { permissions: { hasSome: [...permissions] } },
        { permissions: { hasEvery: [...ADMINISTRATOR_PERMISSIONS] } },
      ] },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Live sites in the order people see them, e.g. for a public site picker. */
export async function liveSites(db?: Db): Promise<SiteRef[]> {
  return (await client(db)).club.findMany({ where: { archivedAt: null }, select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

/** Sites that are not archived: what "a live site" means in module filters. */
export async function liveSiteIds(db?: Db): Promise<string[]> {
  const rows = await (await client(db)).club.findMany({ where: { archivedAt: null }, select: { id: true } });
  return rows.map((row) => row.id);
}

/** A site that no longer exists still needs a label rather than a crash. */
const missingSite = (id: string): SiteStatusRef => ({ id, name: "Removed site", archivedAt: null });

/** Adds `as` (e.g. `club`) to each row, as `{ id, name }`, from the site id in `key` (e.g. `clubId`). */
export async function withSites<K extends string, A extends string, T extends { [P in K]: string }>(
  rows: T[], key: K, as: A, db?: Db,
): Promise<Array<T & { [P in A]: SiteRef }>> {
  const sites = await sitesByIds(rows.map((row) => row[key]), db);
  return rows.map((row) => {
    const site = sites.get(row[key]) ?? missingSite(row[key]);
    return { ...row, [as]: { id: site.id, name: site.name } } as T & { [P in A]: SiteRef };
  });
}

/** `withSites`, with each site's `archivedAt` as well. */
export async function withSiteStatus<K extends string, A extends string, T extends { [P in K]: string }>(
  rows: T[], key: K, as: A, db?: Db,
): Promise<Array<T & { [P in A]: SiteStatusRef }>> {
  const sites = await sitesByIds(rows.map((row) => row[key]), db);
  return rows.map((row) => ({ ...row, [as]: sites.get(row[key]) ?? missingSite(row[key]) }) as T & { [P in A]: SiteStatusRef });
}

/** Adds `as` (e.g. `instructor`) to each row from the user id in `key` (e.g.
 *  `instructorId`); `null` when there is no id or the account was removed. */
export async function withStaff<K extends string, A extends string, T extends { [P in K]: string | null }>(
  rows: T[], key: K, as: A, db?: Db,
): Promise<Array<T & { [P in A]: StaffRef | null }>> {
  const people = await staffByIds(rows.map((row) => row[key]), db);
  return rows.map((row) => ({ ...row, [as]: (row[key] && people.get(row[key] as string)) || null }) as T & { [P in A]: StaffRef | null });
}

/** One row's version of `withSites`. */
export async function withSite<K extends string, A extends string, T extends { [P in K]: string }>(row: T, key: K, as: A, db?: Db) {
  return (await withSites([row], key, as, db))[0];
}

/** One row's version of `withStaff`. */
export async function withOneStaff<K extends string, A extends string, T extends { [P in K]: string | null }>(row: T, key: K, as: A, db?: Db) {
  return (await withStaff([row], key, as, db))[0];
}
