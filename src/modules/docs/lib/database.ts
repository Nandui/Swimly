import type { Member } from './types';

/** A person from the Turnfin staff directory. `siteIds`/`departmentIds` are
 *  their place in the one platform organisation chart (main site, departments
 *  and the sites those departments belong to); `roleIds` is their role, so
 *  documents and reading can be aimed at a role (docs/how-turnfin-works.md). */
export type StaffIdentity = Omit<Member, 'facilityIds' | 'teamIds'> & { siteIds?: string[]; departmentIds?: string[]; roleIds?: string[] };
export type PlatformGroups = { sites: { id: string; name: string }[]; departments: { id: string; name: string }[]; roles?: { id: string; name: string }[] };
export interface StaffDirectory {
  find(id: string): Promise<StaffIdentity | null>;
  list(): Promise<StaffIdentity[]>;
  /** The platform's sites, departments and roles, mirrored into Docs groups. */
  organisation?(): Promise<PlatformGroups>;
}
/** Docs SQL is isolated from the authoritative Turnfin staff directory. */
export interface Sql {
  readonly staff: StaffDirectory;
  readonly access?: { id: string; permissions: string[] };
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
type Membership = Pick<Member, 'id' | 'facilityIds' | 'teamIds'>;
export async function findMember(db: Sql, id: string): Promise<Member | undefined> {
  const identity = await db.staff.find(id);
  if (!identity) return undefined;
  const profile = await one<Membership>(db, 'SELECT * FROM member_profiles WHERE id=$1', [id]);
  return merge(identity, profile);
}
export async function listMembers(db: Sql): Promise<Member[]> {
  const [identities, profiles] = await Promise.all([
    db.staff.list(), rows<Membership>(db, 'SELECT * FROM member_profiles'),
  ]);
  const membership = new Map(profiles.map(profile => [profile.id, profile]));
  return identities.map(identity => merge(identity, membership.get(identity.id))).sort((a, b) => a.name.localeCompare(b.name));
}
/** Docs-only group membership (member_profiles) plus the person's platform
 *  sites, departments and role, which are managed in Staff, never here. A
 *  role is a Docs team whose members are everyone on that role. */
function merge(identity: StaffIdentity, profile?: Membership): Member {
  const { siteIds = [], departmentIds = [], roleIds = [], ...rest } = identity;
  return { ...rest,
    facilityIds: [...new Set([...(profile?.facilityIds ?? []), ...siteIds])],
    teamIds: [...new Set([...(profile?.teamIds ?? []), ...departmentIds, ...roleIds])],
  };
}
export interface Database extends Sql {
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function database(): Promise<Database> {
  return (await import('./runtime-database')).staffDatabase();
}
function camel(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  return value;
}
export async function rows<T>(db: Sql, sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await db.query(sql, params);
  return result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), camel(value),
  ])) as T);
}
export async function one<T = Record<string, unknown>>(db: Sql, sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await rows<T>(db, sql, params))[0];
}
