import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export interface MigrationConnection {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  exec?(sql: string): Promise<unknown>;
}
export const docsTables = [
  'member_profiles', 'groups', 'settings', 'templates', 'documents', 'snapshots',
  'drafts', 'reviews', 'assignment_rules', 'requirements', 'acknowledgements',
  'audit_events', 'attachments', 'attachment_blobs',
] as const;
export async function migrateDocsSchema(db: MigrationConnection) {
  const sql = (await readFile('docs-database/migrations/001_documents.sql', 'utf8')).replace(/\r\n/g, '\n');
  const checksum = createHash('sha256').update(sql).digest('hex');
  await db.query('BEGIN');
  try {
    await db.query('SELECT pg_advisory_xact_lock(20260918, 1201)');
    await db.query('CREATE SCHEMA IF NOT EXISTS turnfin_docs');
    await db.query('CREATE TABLE IF NOT EXISTS turnfin_docs.schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    const applied = (await db.query('SELECT checksum FROM turnfin_docs.schema_migrations WHERE id=$1', ['001_documents'])).rows[0];
    if (applied && applied.checksum !== checksum) throw new Error('The applied Docs migration checksum differs from this build.');
    if (!applied) {
      if ((await db.query("SELECT to_regclass('turnfin_docs.documents') AS existing")).rows[0]?.existing) throw new Error('The destination already has an unmanaged Docs schema; refusing to overwrite it.');
      if (db.exec) await db.exec(sql); else await db.query(sql);
      await db.query('INSERT INTO turnfin_docs.schema_migrations(id,checksum) VALUES($1,$2)', ['001_documents', checksum]);
    }
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

/** Stops old releases from accepting edits after the snapshot is copied.
 * Existing records remain intact, readable and available for recovery. */
export async function freezeSharedDocs(source: MigrationConnection, destination: string) {
  await source.query('BEGIN');
  try {
    await source.query('SELECT id FROM turnfin_docs.workspace_lock WHERE id=1 FOR UPDATE');
    await source.query('CREATE TABLE IF NOT EXISTS turnfin_docs.storage_cutover (id integer PRIMARY KEY CHECK(id=1), destination text NOT NULL, frozen_at timestamptz NOT NULL DEFAULT now())');
    const previous = (await source.query('SELECT destination FROM turnfin_docs.storage_cutover WHERE id=1')).rows[0];
    if (previous && previous.destination !== destination) throw new Error('Docs was already moved to another destination.');
    if (previous) { await source.query('COMMIT'); return; }
    await source.query('INSERT INTO turnfin_docs.storage_cutover(id,destination) VALUES(1,$1) ON CONFLICT(id) DO NOTHING', [destination]);
    await source.query(`CREATE OR REPLACE FUNCTION turnfin_docs.reject_retired_storage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Docs storage has moved. Refresh the app to continue.'; END $$`);
    for (const table of docsTables) {
      await source.query(`DROP TRIGGER IF EXISTS docs_storage_retired ON turnfin_docs.${table}`);
      await source.query(`CREATE TRIGGER docs_storage_retired BEFORE INSERT OR UPDATE OR DELETE ON turnfin_docs.${table} FOR EACH STATEMENT EXECUTE FUNCTION turnfin_docs.reject_retired_storage()`);
    }
    await source.query('COMMIT');
  } catch (error) { await source.query('ROLLBACK'); throw error; }
}

/** Copy only Docs tables, in dependency order. Never copy staff credentials,
 * swimmers, parent accounts or unrelated schemas. Inserts and the copy marker
 * commit together; retries cannot overwrite documents created after cutover. */
export async function copySharedDocs(source: MigrationConnection, target: MigrationConnection, fingerprint: string) {
  await target.query('BEGIN');
  try {
    await target.query('SELECT pg_advisory_xact_lock(20260918, 1202)');
    const previous = (await target.query("SELECT * FROM turnfin_docs.storage_imports WHERE id='shared-db-v1'")).rows[0];
    if (previous) {
      if (previous.source !== fingerprint) throw new Error('Docs has already been imported from a different source.');
      await target.query('COMMIT');
      return { alreadyImported: true, counts: previous.counts };
    }
    for (const table of docsTables.filter(table => table !== 'templates')) {
      if ((await target.query(`SELECT 1 FROM turnfin_docs.${table} LIMIT 1`)).rows.length) throw new Error(`Docs destination contains ${table}; refusing to replace it.`);
    }
    const counts: Record<string, number> = {};
    for (const table of docsTables) {
      const columns = (await target.query('SELECT column_name,data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND is_generated=$3 ORDER BY ordinal_position', ['turnfin_docs', table, 'NEVER'])).rows;
      const names = columns.map(c => `"${c.column_name}"`).join(',');
      const sourceNames = columns.map(c => /timestamp|^date$/.test(String(c.data_type)) ? `"${c.column_name}"::text AS "${c.column_name}"` : `"${c.column_name}"`).join(',');
      const records = (await source.query(`SELECT ${sourceNames} FROM turnfin_docs.${table}`)).rows;
      // Only the structural templates installed above may be replaced.
      if (table === 'templates') await target.query('DELETE FROM turnfin_docs.templates');
      for (const row of records) {
        const values = columns.map(c => {
          const value = row[String(c.column_name)];
          return c.data_type === 'jsonb' && value != null ? JSON.stringify(value) : value;
        });
        await target.query(`INSERT INTO turnfin_docs.${table}(${names}) VALUES(${columns.map((_, i) => '$'+(i+1)).join(',')})`, values);
      }
      const actual = Number((await target.query(`SELECT count(*) AS count FROM turnfin_docs.${table}`)).rows[0].count);
      if (actual !== records.length) throw new Error(`Docs copy verification failed for ${table}.`);
      const digestSql = `SELECT md5(COALESCE(string_agg(hash,'' ORDER BY hash),'')) AS digest FROM (SELECT md5(row_to_json(copied)::text) AS hash FROM (SELECT ${names} FROM turnfin_docs.${table}) copied) hashes`;
      const before = (await source.query(digestSql)).rows[0].digest;
      const after = (await target.query(digestSql)).rows[0].digest;
      if (before !== after) throw new Error(`Docs copy content verification failed for ${table}.`);
      counts[table] = actual;
    }
    await target.query("INSERT INTO turnfin_docs.storage_imports(id,source,counts) VALUES('shared-db-v1',$1,$2)", [fingerprint, JSON.stringify(counts)]);
    await target.query('COMMIT');
    return { alreadyImported: false, counts };
  } catch (error) { await target.query('ROLLBACK'); throw error; }
}
