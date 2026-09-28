import { databaseIdentity } from '../docs/storage-config';

/** HR and performance live in their own database (`HR_DATABASE_URL`), never the
 *  Turnfin/Aquatics or Docs database. Unset means HR is not provisioned yet:
 *  the module says so and nothing else is affected. A misconfiguration that
 *  would put HR records in a shared database is an error. */
export function hrStorageConfig(env: Record<string, string | undefined>) {
  if (!env.HR_DATABASE_URL) return null;
  const runtime = env.HR_DATABASE_URL;
  const direct = env.HR_DIRECT_URL || runtime;
  if (databaseIdentity(runtime) !== databaseIdentity(direct)) throw new Error('HR_DIRECT_URL must point to the same database as HR_DATABASE_URL.');
  for (const shared of [env.DATABASE_URL, env.DIRECT_URL, env.DATABASE_URL_UNPOOLED, env.DOCS_DATABASE_URL, env.DOCS_DIRECT_URL]) {
    if (shared && databaseIdentity(shared) === databaseIdentity(runtime)) throw new Error('HR must use its own database, separate from Turnfin and Docs.');
  }
  return { runtime, direct };
}
