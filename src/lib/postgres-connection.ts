/** Preserve pg's current certificate/hostname verification when it retires its
 *  legacy SSL aliases. Explicit libpq compatibility keeps its requested policy. */
export function postgresConnectionString(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Leave non-URL connection strings and their validation to the driver.
    return connectionString;
  }

  const mode = url.searchParams.get("sslmode");
  if (
    url.searchParams.get("uselibpqcompat") !== "true" &&
    mode && ["prefer", "require", "verify-ca"].includes(mode)
  ) {
    url.searchParams.set("sslmode", "verify-full");
    return url.toString();
  }
  return connectionString;
}

/** How many connections a pool may open: `DATABASE_POOL_MAX` when it is set, otherwise the
 *  caller's own size (undefined keeps pg's default of 10). Only the sandbox sets it, to 1: its
 *  embedded Postgres is one session, so queries from parallel connections would cross. */
export function poolMax(fallback?: number): number | undefined {
  const set = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(set) && set > 0 ? set : fallback;
}

/** Which database a URL points at, ignoring the pooler and credentials, so a
 *  module with its own database (Docs, HR) can refuse to share another's. */
export function databaseIdentity(value: string): string {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("A PostgreSQL connection is required.");
  return `${url.hostname.replace(/-pooler(?=\.)/, "")}:${url.port || "5432"}${url.pathname}`;
}
