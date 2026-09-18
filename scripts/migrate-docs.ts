import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { docsStorageConfig, databaseIdentity } from '../src/lib/docs/storage-config';
import { postgresConnectionString } from '../src/lib/postgres-connection';
import { migrateDocsSchema, freezeSharedDocs, copySharedDocs } from './lib/docs-storage';

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log('Skipping Docs migrations outside Vercel production.');
    return;
  }
  const config = docsStorageConfig(process.env);
  const sourceUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!sourceUrl) throw new Error('Turnfin database configuration is required for the Docs cutover.');
  const hash = (value: string) => createHash('sha256').update(databaseIdentity(value)).digest('hex');
  const target = new Client({ connectionString: postgresConnectionString(config.direct), connectionTimeoutMillis:15000 });
  const source = new Client({ connectionString: postgresConnectionString(sourceUrl), connectionTimeoutMillis:15000 });
  try {
    await target.connect();
    await target.query("SET TIME ZONE 'UTC'");
    await migrateDocsSchema(target);
    await source.connect();
    await source.query("SET TIME ZONE 'UTC'");
    const exists = (await source.query("SELECT to_regclass('turnfin_docs.documents') AS existing")).rows[0]?.existing;
    if (exists) {
      await freezeSharedDocs(source, hash(config.direct));
      const result = await copySharedDocs(source, target, hash(sourceUrl));
      console.log('Docs storage migration verified:', JSON.stringify(result));
    } else console.log('Dedicated Docs schema ready; no legacy Docs storage to transfer.');
  } finally { await Promise.allSettled([source.end(), target.end()]); }
}
main().catch(error => {
  // Drivers may include connection strings or record values in error details.
  console.error('Docs storage migration failed.', { code: typeof error.code === 'string' ? error.code : 'MIGRATION_FAILED' });
  process.exitCode = 1;
});
