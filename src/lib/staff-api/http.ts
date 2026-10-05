import { z } from "zod";
import { StaffApiError } from "@/lib/staff-api/errors";
import { staffApiConfig } from "@/lib/staff-api/config";

/** Request and response plumbing for the staff API, the same contract as the
 *  parent API: JSON only, small bodies, allowlisted origins, no cookies,
 *  never cached. */

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** 16 KiB by default; certificate uploads allow ~7 MiB of base64. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T, limit = 16_384): Promise<z.output<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new StaffApiError(415, "JSON_REQUIRED", "Send a JSON request body.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new StaffApiError(400, "INVALID_REQUEST", "A request body is required.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) { await reader.cancel(); throw new StaffApiError(413, "BODY_TOO_LARGE", "That is too large to send."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new StaffApiError(400, "INVALID_REQUEST", "Send valid JSON."); }
  return parseInput(schema, value);
}

export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new StaffApiError(400, "INVALID_REQUEST", result.error.issues[0]?.message ?? "Check the request fields.");
  return result.data;
}

export function json(data: unknown, status = 200) { return Response.json(data, { status }); }

export async function staffResponse(request: Request, run: () => Promise<Response>): Promise<Response> {
  let allowedOrigin: string | null = null;
  let response: Response;
  try {
    const config = staffApiConfig();
    const origin = request.headers.get("origin");
    if (origin && !config.origins.includes(origin)) throw new StaffApiError(403, "ORIGIN_DENIED", "This app is not allowed to connect.");
    allowedOrigin = origin;
    response = request.method === "OPTIONS" ? new Response(null, { status: 204 }) : await run();
  } catch (error) { response = errorResponse(error); }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type");
    response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return response;
}

export function errorResponse(error: unknown) {
  const known = error instanceof StaffApiError;
  if (!known) console.error("Staff API request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  const response = json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Could not complete that. Try again." } }, known ? error.status : 500);
  if (known && error.status === 429) response.headers.set("Retry-After", "3600");
  if (known && error.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  if (known) for (const [key, value] of Object.entries(error.headers)) response.headers.set(key, value);
  return response;
}
