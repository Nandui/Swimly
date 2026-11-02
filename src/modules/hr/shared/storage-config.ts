import { databaseIdentity } from '@/lib/postgres-connection';

/** HR lives in the main Turnfin database as its own schema, `turnfin_hr` (D23),
 *  reached with the main database's URLs (`DIRECT_URL`, unpooled, for
 *  migrations). Unset means there is no database at all: HR says it is not set
 *  up and nothing else is affected. */
export function hrStorageConfig(env: Record<string, string | undefined>) {
  const runtime = env.DATABASE_URL;
  if (!runtime) return null;
  const direct = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || runtime;
  return { runtime, direct };
}

/** The separate HR database HR used before D23, while its settings remain, for
 *  the production build's one-time copy into `turnfin_hr`. Null when unset or
 *  when it is the main database itself. */
export function legacyHrSource(env: Record<string, string | undefined>) {
  const url = env.HR_DIRECT_URL || env.HR_DB_DATABASE_URL_UNPOOLED || env.HR_DATABASE_URL || env.HR_DB_DATABASE_URL;
  if (!url) return null;
  const main = env.DIRECT_URL || env.DATABASE_URL_UNPOOLED || env.DATABASE_URL;
  if (main && databaseIdentity(main) === databaseIdentity(url)) return null;
  return url;
}
