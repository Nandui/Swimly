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
