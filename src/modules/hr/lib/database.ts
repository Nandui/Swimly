import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { postgresConnectionString } from '@/lib/postgres-connection';
import { hrStorageConfig } from '@/modules/hr/lib/storage-config';

/** The HR database connection. Plain SQL in schema `turnfin_hr`; identity and
 *  access decisions come from the main database and the policy engine, never
 *  from here. Tests replace this module with a PGlite-backed one. */
export type HrSql = { query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> };
export type HrDatabase = HrSql & { transaction<T>(fn: (tx: HrSql) => Promise<T>): Promise<T> };

export class HrUnavailable extends Error {
  constructor() { super('HR storage is not set up yet.'); }
}

const globalHr = globalThis as unknown as { hrPool?: Pool };
function pool() {
  const config = hrStorageConfig(process.env);
  if (!config) throw new HrUnavailable();
  if (!globalHr.hrPool) {
    globalHr.hrPool = new Pool({ connectionString: postgresConnectionString(config.runtime), max: 5 });
    globalHr.hrPool.on('error', () => console.error('[hr] database connection interrupted'));
  }
  return globalHr.hrPool;
}

export function hrConfigured() {
  return hrStorageConfig(process.env) !== null;
}

const sql = (client: PoolClient): HrSql => ({
  query: async <T,>(statement: string, params?: unknown[]) => (await client.query<QueryResultRow>(statement, params)).rows as T[],
});

async function run<T>(fn: (tx: HrSql) => Promise<T>) {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL search_path = turnfin_hr');
    const result = await fn(sql(client));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

export function hrDatabase(): HrDatabase {
  return {
    query: (statement, params) => run((tx) => tx.query(statement, params)),
    transaction: run,
  };
}
