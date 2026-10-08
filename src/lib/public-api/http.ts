import { z } from "zod";

/** Core plumbing for every API a browser outside Turnfin calls: the parent app
 *  (/api/parent/v1), Turnfin Me (/api/staff/v1) and the Academy booking site
 *  (/api/academy/v1). One contract: JSON only, small bodies, allowlisted
 *  origins, no cookies, never cached, and one error envelope. Each API keeps its
 *  own config, secret, routes and wording (docs/architecture.md, "Core owns
 *  shared plumbing"). */

/** An error the API means to show. Messages are written for the API's own
 *  users and never contain record values, credentials or provider details. */
export class PublicApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers: Record<string, string> = {}) { super(message); }
}

export const idSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);

/** Browser origins from a comma-separated setting: https only, or http on
 *  localhost outside production. Null when any entry is not a bare origin. */
export function allowedOrigins(value: string | undefined, env: Record<string, string | undefined> = process.env): string[] | null {
  const origins = (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { return null; }
    const local = env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.origin !== origin || (url.protocol !== "https:" && !local)) return null;
  }
  return origins;
}

/** The token in `Authorization: Bearer <token>`, when it matches the API's shape. */
export function bearerToken(request: Request, shape: RegExp = /^[A-Za-z0-9_-]{20,100}$/): string | null {
  const match = /^Bearer (\S+)$/i.exec(request.headers.get("authorization") ?? "");
  return match && shape.test(match[1]) ? match[1] : null;
}

export function json(data: unknown, status = 200) { return Response.json(data, { status }); }

export type PublicApiOptions = {
  /** Names the API in the server log, e.g. "Staff API". */
  name: string;
  /** The allowed origins; throws the API's own "unavailable" when it is switched off. */
  origins: () => readonly string[];
  /** CORS methods and request headers the API accepts. */
  methods: string;
  headers?: string;
  /** The API's own wording for the shared refusals. */
  messages: { originDenied: string; tooLarge: string; invalid: string };
};

/** The shared plumbing, worded and configured for one API. */
export function publicApi({ name, origins, methods, headers = "Authorization,Content-Type", messages }: PublicApiOptions) {
  function parseInput<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
    const result = schema.safeParse(value);
    if (!result.success) throw new PublicApiError(400, "INVALID_REQUEST", result.error.issues[0]?.message ?? messages.invalid);
    return result.data;
  }

  /** At most 16 KiB of JSON unless the route allows more (Turnfin Me certificate uploads). */
  async function readBody<T extends z.ZodType>(request: Request, schema: T, limit = 16_384): Promise<z.output<T>> {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      throw new PublicApiError(415, "JSON_REQUIRED", "Send a JSON request body.");
    }
    const reader = request.body?.getReader();
    if (!reader) throw new PublicApiError(400, "INVALID_REQUEST", "A request body is required.");
    let length = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) { await reader.cancel(); throw new PublicApiError(413, "BODY_TOO_LARGE", messages.tooLarge); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let value: unknown;
    try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { throw new PublicApiError(400, "INVALID_REQUEST", "Send valid JSON."); }
    return parseInput(schema, value);
  }

  /** The error envelope: `{ error: { code, message } }`, never a stack or provider detail. */
  function errorResponse(error: unknown) {
    const known = error instanceof PublicApiError;
    if (!known) console.error(`${name} request failed`, { name: error instanceof Error ? error.name : "UnknownError" });
    const response = json({ error: { code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "Could not complete that. Try again." } }, known ? error.status : 500);
    if (known && error.status === 429) response.headers.set("Retry-After", "3600");
    if (known && error.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
    if (known) for (const [key, value] of Object.entries(error.headers)) response.headers.set(key, value);
    return response;
  }

  /** Runs a request: refuses unknown origins, answers preflight, and marks every
   *  response no-store, with CORS only for an allowed origin. */
  async function respond(request: Request, run: () => Promise<Response>): Promise<Response> {
    let allowedOrigin: string | null = null;
    let response: Response;
    try {
      const allowed = origins();
      const origin = request.headers.get("origin");
      if (origin && !allowed.includes(origin)) throw new PublicApiError(403, "ORIGIN_DENIED", messages.originDenied);
      allowedOrigin = origin;
      response = request.method === "OPTIONS" ? new Response(null, { status: 204 }) : await run();
    } catch (error) { response = errorResponse(error); }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Vary", "Origin");
    response.headers.set("X-Content-Type-Options", "nosniff");
    if (allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
      response.headers.set("Access-Control-Allow-Methods", methods);
      response.headers.set("Access-Control-Allow-Headers", headers);
      response.headers.set("Access-Control-Expose-Headers", "Retry-After");
    }
    return response;
  }

  return { parseInput, readBody, errorResponse, respond };
}
