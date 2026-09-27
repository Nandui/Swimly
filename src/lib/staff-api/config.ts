import { unavailable } from "@/lib/staff-api/errors";

/** The staff API is off unless STAFF_API_ENABLED=true with a secret of at
 *  least 32 characters. Browsers may call it only from the Turnfin Me origins
 *  in STAFF_API_ALLOWED_ORIGINS (https, or http on localhost outside
 *  production). STAFF_ME_URL is where reminder emails link. */
export function staffApiConfig(env: Record<string, string | undefined> = process.env) {
  const secret = env.STAFF_AUTH_SECRET ?? "";
  if (env.STAFF_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = (env.STAFF_API_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { unavailable(); }
    const local = env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== "https:" && !local)) unavailable();
  }
  return { secret, origins, meUrl: (env.STAFF_ME_URL ?? origins[0] ?? "").replace(/\/$/, "") };
}
