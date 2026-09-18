export function databaseIdentity(value: string): string {
  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('A PostgreSQL connection is required.');
  return `${url.hostname.replace(/-pooler(?=\.)/, '')}:${url.port || '5432'}${url.pathname}`;
}
export function docsStorageConfig(env: Record<string, string | undefined>) {
  if (!env.DOCS_DATABASE_URL) throw new Error('DOCS_DATABASE_URL is required; Docs never falls back to the Aquatics database.');
  const runtime = env.DOCS_DATABASE_URL;
  const direct = env.DOCS_DIRECT_URL || runtime;
  if (databaseIdentity(runtime) !== databaseIdentity(direct)) throw new Error('DOCS_DIRECT_URL must point to the same database as DOCS_DATABASE_URL.');
  for (const shared of [env.DATABASE_URL, env.DIRECT_URL]) {
    if (shared && databaseIdentity(shared) === databaseIdentity(runtime)) throw new Error('Docs must use a separate database from Turnfin/Aquatics.');
  }
  return { runtime, direct };
}
