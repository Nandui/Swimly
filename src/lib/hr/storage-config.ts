import { databaseIdentity } from '@/lib/postgres-connection';

/** HR and performance live in their own database, never the Turnfin/Aquatics
 *  or Docs database. Set `HR_DATABASE_URL` (and `HR_DIRECT_URL`, unpooled, for
 *  migrations), or attach the database through Vercel's Neon integration with
 *  the prefix `HR_DB`, which provides `HR_DB_DATABASE_URL` and
 *  `HR_DB_DATABASE_URL_UNPOOLED`. Unset means HR is not provisioned yet: the
 *  module says so and nothing else is affected. A misconfiguration that would
 *  put HR records in a shared database is an error. */
export function hrStorageConfig(env: Record<string, string | undefined>) {
  const runtime = env.HR_DATABASE_URL || env.HR_DB_DATABASE_URL;
  if (!runtime) return null;
  const direct = env.HR_DIRECT_URL || env.HR_DB_DATABASE_URL_UNPOOLED || runtime;
  if (databaseIdentity(runtime) !== databaseIdentity(direct)) throw new Error('The HR direct URL must point to the same database as the HR database URL.');
  for (const shared of [env.DATABASE_URL, env.DIRECT_URL, env.DATABASE_URL_UNPOOLED, env.DOCS_DATABASE_URL, env.DOCS_DIRECT_URL]) {
    if (shared && databaseIdentity(shared) === databaseIdentity(runtime)) throw new Error('HR must use its own database, separate from Turnfin and Docs.');
  }
  return { runtime, direct };
}
