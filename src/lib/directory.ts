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
/** A site with whether it is archived and its short code (e.g. "BT"), for
 *  callers that filter, label or number on it. */
export type SiteStatusRef = SiteRef & { archivedAt: Date | null; code: string | null };

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
  const rows = await (await client(db)).club.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true, archivedAt: true, code: true } });
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

/** A site's areas (Admin, Areas), in order: what a class's or an assessment's "where" picks from. */
export async function areaNamesAt(siteId: string, db?: Pick<Prisma.TransactionClient, "siteArea">): Promise<string[]> {
  const rows = await (db ?? (await import("@/lib/prisma")).prisma).siteArea.findMany({ where: { siteId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true } });
  return rows.map((row) => row.name);
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
const missingSite = (id: string): SiteStatusRef => ({ id, name: "Removed site", archivedAt: null, code: null });

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

/** A person as modules that follow the organisation chart see them: their
 *  role and its permissions, their main site and their live departments with
 *  each department's site. No passwords or personal details. */
export type StaffProfile = {
  id: string; name: string; email: string; isActive: boolean; isSuperadmin: boolean; primarySiteId: string | null;
  role: { id: string; name: string; permissions: string[] } | null;
  departments: { id: string; siteId: string | null }[];
};

const profileSelect = { id: true, name: true, email: true, isActive: true, isSuperadmin: true, primaryClubId: true,
  departments: { select: { departmentId: true, department: { select: { clubId: true, archivedAt: true } } } },
  staffRole: { select: { id: true, name: true, permissions: true } },
} as const;

function profile(user: { id: string; name: string; email: string; isActive: boolean; isSuperadmin: boolean; primaryClubId: string | null;
  departments: { departmentId: string; department: { clubId: string | null; archivedAt: Date | null } }[];
  staffRole: { id: string; name: string; permissions: string[] } | null;
}): StaffProfile {
  return { id: user.id, name: user.name, email: user.email, isActive: user.isActive, isSuperadmin: user.isSuperadmin, primarySiteId: user.primaryClubId,
    role: user.staffRole, departments: user.departments.filter((d) => !d.department.archivedAt).map((d) => ({ id: d.departmentId, siteId: d.department.clubId })) };
}

/** One person's profile, or null when the account no longer exists. */
export async function staffProfile(id: string): Promise<StaffProfile | null> {
  const user = await (await client()).user.findUnique({ where: { id }, select: profileSelect });
  return user ? profile(user) : null;
}

/** Every account's profile, by name, active or not. */
export async function staffProfiles(): Promise<StaffProfile[]> {
  return (await (await client()).user.findMany({ select: profileSelect, orderBy: { name: "asc" } })).map(profile);
}

/** The organisation chart's live sites and departments and every role, each
 *  in the order Admin shows them. */
export async function organisationChart(): Promise<{ sites: SiteRef[]; departments: SiteRef[]; roles: SiteRef[] }> {
  const { prisma } = await import("@/lib/prisma");
  const order = [{ sortOrder: "asc" as const }, { name: "asc" as const }];
  const [sites, departments, roles] = await Promise.all([
    prisma.club.findMany({ where: { archivedAt: null }, orderBy: order, select: { id: true, name: true } }),
    prisma.department.findMany({ where: { archivedAt: null }, orderBy: order, select: { id: true, name: true } }),
    prisma.staffRole.findMany({ orderBy: order, select: { id: true, name: true } }),
  ]);
  return { sites, departments, roles };
}

/** Every site, archived ones too, in the order people see them (e.g. a filter over past records). */
export async function allSites(db?: Db): Promise<SiteRef[]> {
  return (await client(db)).club.findMany({ select: { id: true, name: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}

/** This site when it is live, else null. Read inside a module's transaction
 *  so the check and the write see the same data. */
export async function liveSiteById(id: string, db?: Db): Promise<SiteRef | null> {
  return (await client(db)).club.findFirst({ where: { id, archivedAt: null }, select: { id: true, name: true } });
}

/** The sites a person works at (`User.siteIds`): empty means every site, as it
 *  does on the account; also empty when the account no longer exists. */
export async function staffSiteIds(id: string, db?: Db): Promise<string[]> {
  return (await (await client(db)).user.findUnique({ where: { id }, select: { siteIds: true } }))?.siteIds ?? [];
}

/** A person with their role's stored permissions (null without a role), for a
 *  module that decides who to notify from its own access rules. */
export type StaffAccess = StaffRef & { email: string; isActive: boolean; rolePermissions: string[] | null };
const accessSelect = { id: true, name: true, email: true, isActive: true, staffRole: { select: { permissions: true } } } as const;
const access = (u: { id: string; name: string; email: string; isActive: boolean; staffRole: { permissions: string[] } | null }): StaffAccess =>
  ({ id: u.id, name: u.name, email: u.email, isActive: u.isActive, rolePermissions: u.staffRole?.permissions ?? null });

export async function staffAccess(id: string, db?: Db): Promise<StaffAccess | null> {
  const user = await (await client(db)).user.findUnique({ where: { id }, select: accessSelect });
  return user ? access(user) : null;
}

/** Active accounts with their role's permissions; only these ids when given. */
export async function activeStaffAccess(ids?: readonly string[], db?: Db): Promise<StaffAccess[]> {
  return (await (await client(db)).user.findMany({ where: { isActive: true, ...(ids ? { id: { in: [...ids] } } : {}) }, select: accessSelect })).map(access);
}

/** An organisation's live sites with their short codes, in order. */
export async function liveSitesOf(orgId: string | null, db?: Db): Promise<Array<SiteRef & { code: string | null }>> {
  return (await client(db)).club.findMany({ where: { orgId: orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } });
}

/* Roles, by id and name only. Modules ask for permissions, never role names;
 * these are for rules a module keeps per role (e.g. who approves purchases). */
export type RoleRef = { id: string; name: string };
type RoleDb = Pick<Prisma.TransactionClient, "staffRole" | "user">;
async function roleClient(db?: RoleDb): Promise<RoleDb> {
  return db ?? (await import("@/lib/prisma")).prisma;
}

/** Every role, by name. */
export async function allRoles(db?: RoleDb): Promise<RoleRef[]> {
  return (await roleClient(db)).staffRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

export async function roleById(id: string, db?: RoleDb): Promise<RoleRef | null> {
  return (await roleClient(db)).staffRole.findFirst({ where: { id }, select: { id: true, name: true } });
}

export async function rolesByIds(ids: readonly (string | null | undefined)[], db?: RoleDb): Promise<Map<string, RoleRef>> {
  const wanted = unique(ids);
  if (wanted.length === 0) return new Map();
  const rows = await (await roleClient(db)).staffRole.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } });
  return new Map(rows.map((row) => [row.id, row]));
}

/** Adds `as` (e.g. `role`) to each row from the role id in `key`; a removed role reads "Removed role". */
export async function withRoles<K extends string, A extends string, T extends { [P in K]: string }>(
  rows: T[], key: K, as: A, db?: RoleDb,
): Promise<Array<T & { [P in A]: RoleRef }>> {
  const roles = await rolesByIds(rows.map((row) => row[key]), db);
  return rows.map((row) => ({ ...row, [as]: roles.get(row[key]) ?? { id: row[key], name: "Removed role" } }) as T & { [P in A]: RoleRef });
}

/** The role a person holds, or null. */
export async function staffRoleIdOf(userId: string, db?: RoleDb): Promise<string | null> {
  return (await (await roleClient(db)).user.findUnique({ where: { id: userId }, select: { staffRoleId: true } }))?.staffRoleId ?? null;
}
