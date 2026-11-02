import 'dotenv/config';
import { Client } from 'pg';
import { databasePlan } from '../src/lib/database-environment';
import { hrStorageConfig } from '../src/modules/hr/shared/storage-config';
import { postgresConnectionString } from '../src/lib/postgres-connection';
import { migrateHrSchema } from './lib/hr-storage';

/** HR is the `turnfin_hr` schema in the main database (D23). Builds migrate it
 *  wherever they migrate the main database (production, development previews). */
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
  } finally { await target.end().catch(() => {}); }
}
main().catch((error) => {
  // Drivers may include connection strings or record values in error details.
  console.error('HR migration failed.', { code: typeof error.code === 'string' ? error.code : 'MIGRATION_FAILED' });
  process.exitCode = 1;
});
