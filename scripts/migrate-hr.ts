import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { databasePlan } from '../src/lib/database-environment';
import { hrStorageConfig, legacyHrSource } from '../src/modules/hr/shared/storage-config';
import { databaseIdentity, postgresConnectionString } from '../src/lib/postgres-connection';
import { copyLegacyHr, migrateHrSchema } from './lib/hr-storage';

/** HR is the `turnfin_hr` schema in the main database (D23). Builds migrate it
 *  wherever they migrate the main database (production, development previews).
 *  In production, while the old separate HR database's settings remain, its
 *  rows are copied in once (counts only are logged). */
async function main() {
  if (!databasePlan(process.env).migrate) {
    console.log('Skipping HR migrations: this deployment does not migrate the main database.');
    return;
  }
  const config = hrStorageConfig(process.env);
  if (!config) throw new Error('The main database configuration is required for HR.');
  const target = new Client({ connectionString: postgresConnectionString(config.direct), connectionTimeoutMillis: 15000 });
  try {
    await target.connect();
    await target.query("SET TIME ZONE 'UTC'");
    await migrateHrSchema(target);
    console.log('HR schema ready in the main database.');
    const legacy = process.env.VERCEL_ENV === 'production' ? legacyHrSource(process.env) : null;
    if (!legacy) return;
    const source = new Client({ connectionString: postgresConnectionString(legacy), connectionTimeoutMillis: 15000 });
    try {
      await source.connect();
      await source.query("SET TIME ZONE 'UTC'");
      const fingerprint = createHash('sha256').update(databaseIdentity(legacy)).digest('hex');
      console.log('HR copy from the old HR database verified:', JSON.stringify(await copyLegacyHr(source, target, fingerprint)));
    } finally { await source.end().catch(() => {}); }
  } finally { await target.end().catch(() => {}); }
}
main().catch((error) => {
  // Drivers may include connection strings or record values in error details.
  console.error('HR migration failed.', { code: typeof error.code === 'string' ? error.code : 'MIGRATION_FAILED', message: error instanceof Error && /^HR /.test(error.message) ? error.message : undefined });
  process.exitCode = 1;
});
