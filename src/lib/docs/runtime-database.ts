import 'server-only';
import { cache } from 'react';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { auth } from '@/auth';
import { DomainError } from './domain';
import type { Database, Sql } from './database';
import { staffDirectory } from './staff-directory';
import { postgresConnectionString } from '@/lib/postgres-connection';
import { docsStorageConfig } from './storage-config';

const globalDocs = globalThis as unknown as { docsPool?: Pool };
function pool() {
  if (!process.env.DOCS_DATABASE_URL) throw new DomainError('Docs storage is not configured.', 503);
  if (!globalDocs.docsPool) {
    globalDocs.docsPool = new Pool({ connectionString: postgresConnectionString(docsStorageConfig(process.env).runtime), max: 5 });
    globalDocs.docsPool.on('error', () => console.error('[docs] database connection interrupted'));
  }
  return globalDocs.docsPool;
}

/** Each request carries its effective grants (including role preview). A domain
 * mutation also rechecks the current database grants inside its transaction. */
export const staffDatabase = cache(async (): Promise<Database> => {
  const session = await auth();
  if (!session?.user?.id) throw new DomainError('Please sign in again.', 401);
  const access = { id: session.user.id, permissions: session.user.permissions, screens: session.user.screens };
  function sql(client: PoolClient): Sql {
    return { access, staff: staffDirectory, query: async <T>(statement: string, params?: unknown[]) => {
      const result = await client.query<QueryResultRow>(statement, params);
      return { rows: result.rows as T[] };
    } };
  }
  async function transaction<T>(fn: (tx: Sql) => Promise<T>, lock: boolean) {
    const client = await pool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL search_path = turnfin_docs');
      if (lock) await client.query('SELECT id FROM workspace_lock WHERE id=1 FOR UPDATE');
      const result = await fn(sql(client));
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }
  return {
    access,
    staff: staffDirectory,
    query: (statement, params) => transaction(tx => tx.query(statement, params), false),
    transaction: fn => transaction(fn, true),
    // The pool is shared across requests and must not be closed by a page.
    close: async () => {},
  };
});
