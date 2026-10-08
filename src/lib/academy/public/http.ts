import { z } from "zod";

/** Plumbing for the Academy booking API (/api/academy/v1), the same contract as the parent and
 *  staff APIs: JSON only, small bodies, allowlisted origins, no cookies, never cached.
 *
 *  It is off unless ACADEMY_API_ENABLED=true with ACADEMY_AUTH_SECRET of at least 32 characters.
 *  Browsers may call it only from the booking site's origins in ACADEMY_API_ALLOWED_ORIGINS
 *  (https, or http on localhost outside production). See docs/academy.md. */

export class AcademyApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers: Record<string, string> = {}) { super(message); }
}

export function unavailable(): never {
  throw new AcademyApiError(503, "UNAVAILABLE", "Online booking is not available right now. Try again later, or phone us.");
}
export function notFound(): never {
  throw new AcademyApiError(404, "NOT_FOUND", "That course is not open for booking.");
}

export function academyApiConfig(env: Record<string, string | undefined> = process.env) {
  const secret = env.ACADEMY_AUTH_SECRET ?? "";
  if (env.ACADEMY_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = (env.ACADEMY_API_ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { unavailable(); }
    const local = env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== "https:" && !local)) unavailable();
  }
  return { secret, origins, siteUrl: (env.ACADEMY_SITE_URL ?? origins[0] ?? "").replace(/\/$/, "") };
}

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const emailSchema = z.string().trim().toLowerCase().email("Enter your email address.").max(254);

export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new AcademyApiError(400, "INVALID_REQUEST", result.error.issues[0]?.message ?? "Check the details and try again.");
  return result.data;
}

/** At most 16 KiB of JSON. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T, limit = 16_384): Promise<z.output<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new AcademyApiError(415, "JSON_REQUIRED", "Send a JSON request body.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AcademyApiError(400, "INVALID_REQUEST", "A request body is required.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new AcademyApiError(413, "BODY_TOO_LARGE", "That is too large to send."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AcademyApiError(400, "INVALID_REQUEST", "Send valid JSON."); }
  return parseInput(schema, value);
}

export function json(data: unknown, status = 200) { return Response.json(data, { status }); }

export function errorResponse(error: unknown) {
  const known = error instanceof AcademyApiError;
  if (!known) console.error("Academy API request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  const response = json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Could not complete that. Try again." } }, known ? error.status : 500);
  if (known && error.status === 429) response.headers.set("Retry-After", "3600");
  if (known && error.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  if (known) for (const [key, value] of Object.entries(error.headers)) response.headers.set(key, value);
  return response;
}

export async function academyResponse(request: Request, run: () => Promise<Response>): Promise<Response> {
  let allowedOrigin: string | null = null;
  let response: Response;
  try {
    const config = academyApiConfig();
    const origin = request.headers.get("origin");
    if (origin && !config.origins.includes(origin)) throw new AcademyApiError(403, "ORIGIN_DENIED", "This site is not allowed to connect.");
    allowedOrigin = origin;
    response = request.method === "OPTIONS" ? new Response(null, { status: 204 }) : await run();
  } catch (error) { response = errorResponse(error); }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return response;
}
