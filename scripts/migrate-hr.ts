import 'dotenv/config';
import { Client } from 'pg';
import { hrStorageConfig } from '../src/modules/hr/shared/storage-config';
import { postgresConnectionString } from '../src/lib/postgres-connection';
import { migrateHrSchema } from './lib/hr-storage';

/** Production builds apply HR migrations to the HR database, and only when one
 *  is configured. Until then HR stays switched off and nothing is written. */
async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('Skipping HR migrations outside Vercel production.');
    return;
  }
  const config = hrStorageConfig(process.env);
  if (!config) {
    console.log('No HR database is set (HR_DATABASE_URL or HR_DB_DATABASE_URL); HR stays off until it is provisioned.');
    return;
  }
  const client = new Client({ connectionString: postgresConnectionString(config.direct), connectionTimeoutMillis: 15000 });
  try {
    await client.connect();
    await client.query("SET TIME ZONE 'UTC'");
    await migrateHrSchema(client);
    console.log('HR schema ready.');
  } finally { await client.end().catch(() => {}); }
}
main().catch((error) => {
  // Drivers may include connection strings or record values in error details.
  console.error('HR migration failed.', { code: typeof error.code === 'string' ? error.code : 'MIGRATION_FAILED' });
  process.exitCode = 1;
});
