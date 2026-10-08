import { allowedOrigins } from "@/lib/public-api/http";
import { unavailable } from "@/lib/staff-api/errors";

/** The staff API is off unless STAFF_API_ENABLED=true with a secret of at
 *  least 32 characters. Browsers may call it only from the Turnfin Me origins
 *  in STAFF_API_ALLOWED_ORIGINS (https, or http on localhost outside
 *  production). STAFF_ME_URL is where reminder emails link. */
export function staffApiConfig(env: Record<string, string | undefined> = process.env) {
  const secret = env.STAFF_AUTH_SECRET ?? "";
  if (env.STAFF_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = allowedOrigins(env.STAFF_API_ALLOWED_ORIGINS, env) ?? unavailable();
  return { secret, origins, meUrl: (env.STAFF_ME_URL ?? origins[0] ?? "").replace(/\/$/, "") };
}
