import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
import type { HrDatabase, HrSql } from '@/modules/hr/lib/database';

/** An isolated in-memory HR database with every committed HR migration.
 *  Stands in for `@/modules/hr/lib/database` in tests; never reads real settings. */
export async function createHrTestDatabase() {
  const pg = new PGlite();
  for (const file of (await readdir('hr-database/migrations')).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort()) {
    await pg.exec(await readFile(`hr-database/migrations/${file}`, 'utf8'));
  }
  await pg.exec('SET search_path = turnfin_hr');
  const wrap = (q: { query: PGlite['query'] }): HrSql => ({ query: async <T,>(sql: string, params?: unknown[]) => (await q.query<T>(sql, params)).rows });
  const db: HrDatabase = { ...wrap(pg), transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))) };
  return {
    db,
    module: { hrDatabase: () => db, hrConfigured: () => true, HrUnavailable: class extends Error {} },
    close: () => pg.close(),
  };
}
