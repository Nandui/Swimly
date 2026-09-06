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
