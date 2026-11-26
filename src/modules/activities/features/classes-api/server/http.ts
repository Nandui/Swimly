import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { PublicApiError, bearerToken, publicApi } from "@/lib/public-api/http";
import { prisma } from "@/lib/prisma";

/** Plumbing for the classes API (/api/classes/v1): Core's public-API kit
 *  (src/lib/public-api/http.ts), for another app's server, never a browser.
 *
 *  It is off unless CLASSES_API_ENABLED=true and CLASSES_API_KEYS names at least one app. Each
 *  app has its own key, and Turnfin keeps only the key's SHA-256: `CLASSES_API_KEYS` is a
 *  comma-separated list of `App name:hash` (`scripts/classes-api-key.ts` makes a key and its
 *  line). Taking an app off the list ends its access at the next deploy. The app's name is what
 *  the log shows for everything it changes. */

export class ClassesApiError extends PublicApiError {}

export function unavailable(): never {
  throw new ClassesApiError(503, "UNAVAILABLE", "The classes API is not switched on.");
}
export function notFound(): never {
  throw new ClassesApiError(404, "NOT_FOUND", "There is no such class.");
}

export type ClassesApiApp = { name: string; hash: Buffer };

const ENTRY = /^([A-Za-z0-9][A-Za-z0-9 _-]{0,39}):([a-f0-9]{64})$/;

/** The apps that hold a key. Any entry that does not read as `App name:hash`, or a name used
 *  twice, switches the whole API off: a typing mistake must never leave a door half open. */
export function classesApiConfig(env: Record<string, string | undefined> = process.env) {
  if (env.CLASSES_API_ENABLED !== "true") unavailable();
  const apps: ClassesApiApp[] = [];
  for (const entry of (env.CLASSES_API_KEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const match = ENTRY.exec(entry);
    if (!match || apps.some((app) => app.name.toLowerCase() === match[1].trim().toLowerCase())) unavailable();
    apps.push({ name: match[1].trim(), hash: Buffer.from(match[2], "hex") });
  }
  if (apps.length === 0) unavailable();
  return { apps, rateKey: env.CLASSES_API_KEYS ?? "" };
}

/** The app whose key this request carries (`Authorization: Bearer <key>`). */
export function authenticateApp(request: Request): ClassesApiApp {
  const { apps } = classesApiConfig();
  const token = bearerToken(request);
  const presented = token ? createHash("sha256").update(token).digest() : null;
  // Every key is compared, so the time taken says nothing about which one matched.
  let found: ClassesApiApp | null = null;
  for (const app of apps) if (presented && timingSafeEqual(presented, app.hash)) found = app;
  if (!found) throw new ClassesApiError(401, "UNAUTHORIZED", "Send this app's key as a Bearer token.");
  return found;
}

/** A counter per caller in the swim school's rate-limit table; keys are hashed and prefixed, so
 *  they never collide with the parent API's and never hold an address or an app's name. */
export async function rateLimit(bucket: string, maximum: number, seconds: number) {
  const now = new Date();
  const key = createHmac("sha256", classesApiConfig().rateKey).update(`classes-rate:${bucket}`).digest("hex");
  const cutoff = new Date(now.getTime() - seconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ParentRateLimit" (key,"windowStart",count) VALUES (${key},${now},1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "ParentRateLimit".count + 1 END,
      "windowStart" = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "ParentRateLimit"."windowStart" END
    RETURNING count`;
  if (rows[0].count > maximum) throw new ClassesApiError(429, "RATE_LIMITED", "Too many requests. Wait a minute and try again.", { "Retry-After": String(seconds) });
}

export { idSchema, json, requestIp } from "@/lib/public-api/http";

/** No browser origin is allowed: a request that carries one is refused before anything else. */
export const { readBody, parseInput, respond: classesResponse } = publicApi({
  name: "Classes API",
  origins: () => { classesApiConfig(); return []; },
  methods: "GET,PUT",
  messages: { originDenied: "This API is for another app's server, not a browser.", tooLarge: "That is too large to send.", invalid: "Check the request fields." },
});
