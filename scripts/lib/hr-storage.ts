import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import type { MigrationConnection } from './docs-storage';

/** Applies every `hr-database/migrations/NNN_name.sql` in order, once each,
 *  verifying the checksum of those already applied (the Docs pattern). */
export async function migrateHrSchema(db: MigrationConnection) {
  const files = (await readdir('hr-database/migrations')).filter((name) => /^\d{3}_.+\.sql$/.test(name)).sort();
  await db.query('BEGIN');
  try {
    await db.query('SELECT pg_advisory_xact_lock(20260930, 1301)');
    await db.query('CREATE SCHEMA IF NOT EXISTS turnfin_hr');
    await db.query('CREATE TABLE IF NOT EXISTS turnfin_hr.schema_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
    for (const file of files) {
      const id = file.replace(/\.sql$/, '');
      const sql = (await readFile(`hr-database/migrations/${file}`, 'utf8')).replace(/\r\n/g, '\n');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const applied = (await db.query('SELECT checksum FROM turnfin_hr.schema_migrations WHERE id=$1', [id])).rows[0];
      if (applied && applied.checksum !== checksum) throw new Error(`The applied HR migration ${id} differs from this build.`);
      if (applied) continue;
      if (db.exec) await db.exec(sql); else await db.query(sql);
      await db.query('INSERT INTO turnfin_hr.schema_migrations(id,checksum) VALUES($1,$2)', [id, checksum]);
    }
    await db.query('COMMIT');
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

const HR_TABLES = ['notes', 'reviews', 'access_events', 'audit_events'] as const;

/** D23: copies every HR row from the separate HR database into `turnfin_hr` in
 *  the main database, once. Refuses if the destination already holds HR rows it
 *  did not import, or was imported from another source. Copies the columns both
 *  sides have (the old database may predate later migrations, whose columns keep
 *  their defaults), verifies counts and content, and keeps ids and sequences.
 *  Returns counts only: never a value. */
export async function copyLegacyHr(source: MigrationConnection, target: MigrationConnection, fingerprint: string) {
  await target.query('BEGIN');
  try {
    await target.query('SELECT pg_advisory_xact_lock(20260930, 1302)');
    const previous = (await target.query("SELECT source, counts FROM turnfin_hr.storage_imports WHERE id='hr-db-v1'")).rows[0];
    if (previous) {
      if (previous.source !== fingerprint) throw new Error('HR has already been imported from a different source.');
      await target.query('COMMIT');
      return { alreadyImported: true, counts: previous.counts };
    }
    for (const table of HR_TABLES) {
      if ((await target.query(`SELECT 1 FROM turnfin_hr.${table} LIMIT 1`)).rows.length) throw new Error(`HR destination already holds ${table}; refusing to replace it.`);
    }
    const counts: Record<string, number> = {};
    for (const table of HR_TABLES) {
      const columnsOf = async (db: MigrationConnection) => (await db.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 ORDER BY ordinal_position', ['turnfin_hr', table])).rows;
      const sourceColumns = new Set((await columnsOf(source)).map((c) => String(c.column_name)));
      const columns = (await columnsOf(target)).filter((c) => sourceColumns.has(String(c.column_name)));
      const names = columns.map((c) => `"${c.column_name}"`).join(',');
      const sourceNames = columns.map((c) => /timestamp|^date$/.test(String(c.data_type)) ? `"${c.column_name}"::text AS "${c.column_name}"` : `"${c.column_name}"`).join(',');
      const records = (await source.query(`SELECT ${sourceNames} FROM turnfin_hr.${table}`)).rows;
      for (const row of records) {
        await target.query(`INSERT INTO turnfin_hr.${table}(${names}) VALUES(${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map((c) => row[String(c.column_name)]));
      }
      const actual = Number((await target.query(`SELECT count(*) AS count FROM turnfin_hr.${table}`)).rows[0].count);
      if (actual !== records.length) throw new Error(`HR copy verification failed for ${table}.`);
      const digestSql = `SELECT md5(COALESCE(string_agg(hash,'' ORDER BY hash),'')) AS digest FROM (SELECT md5(row_to_json(copied)::text) AS hash FROM (SELECT ${names} FROM turnfin_hr.${table}) copied) hashes`;
      if ((await source.query(digestSql)).rows[0].digest !== (await target.query(digestSql)).rows[0].digest) throw new Error(`HR copy content verification failed for ${table}.`);
      // The event logs number their rows; carry on after the copied ids.
      if (table === 'access_events' || table === 'audit_events') {
        await target.query(`SELECT setval(pg_get_serial_sequence('turnfin_hr.${table}', 'id'), COALESCE((SELECT max(id) FROM turnfin_hr.${table}), 0) + 1, false)`);
      }
      counts[table] = actual;
    }
    await target.query("INSERT INTO turnfin_hr.storage_imports(id, source, counts) VALUES('hr-db-v1', $1, $2)", [fingerprint, JSON.stringify(counts)]);
    await target.query('COMMIT');
    return { alreadyImported: false, counts };
  } catch (error) { await target.query('ROLLBACK'); throw error; }
}
