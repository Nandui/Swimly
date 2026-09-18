import type { Member } from './types';

export type StaffIdentity = Omit<Member, 'facilityIds' | 'teamIds'>;
export interface StaffDirectory {
  find(id: string): Promise<StaffIdentity | null>;
  list(): Promise<StaffIdentity[]>;
}
/** Docs SQL is isolated from the authoritative Turnfin staff directory. */
export interface Sql {
  readonly staff: StaffDirectory;
  readonly access?: { id: string; permissions: string[]; screens: string[] };
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
type Membership = Pick<Member, 'id' | 'facilityIds' | 'teamIds'>;
export async function findMember(db: Sql, id: string): Promise<Member | undefined> {
  const identity = await db.staff.find(id);
  if (!identity) return undefined;
  const profile = await one<Membership>(db, 'SELECT * FROM member_profiles WHERE id=$1', [id]);
  return { ...identity, facilityIds: profile?.facilityIds ?? [], teamIds: profile?.teamIds ?? [] };
}
export async function listMembers(db: Sql): Promise<Member[]> {
  const [identities, profiles] = await Promise.all([
    db.staff.list(), rows<Membership>(db, 'SELECT * FROM member_profiles'),
  ]);
  const membership = new Map(profiles.map(profile => [profile.id, profile]));
  return identities.map(identity => ({ ...identity,
    facilityIds: membership.get(identity.id)?.facilityIds ?? [],
    teamIds: membership.get(identity.id)?.teamIds ?? [],
  })).sort((a, b) => a.name.localeCompare(b.name));
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
