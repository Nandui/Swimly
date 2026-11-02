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

