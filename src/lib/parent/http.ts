import { z } from "zod";
import { ParentApiError } from "@/lib/parent/errors";
import { parentConfig } from "@/lib/parent/config";

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const reasonSchema = z.string().trim().min(3).max(500);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.output<T>> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ParentApiError(415, "JSON_REQUIRED", "Send a JSON request body.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ParentApiError(400, "INVALID_REQUEST", "A request body is required.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 16_384) { await reader.cancel(); throw new ParentApiError(413, "BODY_TOO_LARGE", "The request is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ParentApiError(400, "INVALID_REQUEST", "Send valid JSON."); }
  return parseInput(schema, value);
}

export function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new ParentApiError(400, "INVALID_REQUEST", result.error.issues[0]?.message ?? "Check the request fields.");
  return result.data;
}

export function json(data: unknown, status = 200) { return Response.json(data, { status }); }

export async function parentResponse(request: Request, run: () => Promise<Response>): Promise<Response> {
  let allowedOrigin: string | null = null;
  let response: Response;
  try {
    const config = parentConfig();
    const origin = request.headers.get("origin");
    if (origin && !config.origins.includes(origin)) throw new ParentApiError(403, "ORIGIN_DENIED", "This app is not allowed to connect.");
    allowedOrigin = origin;
    response = request.method === "OPTIONS" ? new Response(null, { status: 204 }) : await run();
  } catch (error) { response = errorResponse(error); }
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Vary", "Origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Authorization,Content-Type,Idempotency-Key");
    response.headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  return response;
}

export function errorResponse(error: unknown) {
  const known = error instanceof ParentApiError;
  if (!known) console.error("Parent API request failed", { name: error instanceof Error ? error.name : "UnknownError" });
  const response = json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Something went wrong. Please try again." } }, known ? error.status : 500);
  if (known && error.status === 429) response.headers.set("Retry-After", "3600");
  if (known && error.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  if (known) for (const [key, value] of Object.entries(error.headers)) response.headers.set(key, value);
  return response;
}
