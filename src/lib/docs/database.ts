/** Small SQL boundary shared by the imported workflow and in-memory verification. */
export interface Sql {
  readonly access?: { id: string; permissions: string[]; screens: string[] };
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
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
