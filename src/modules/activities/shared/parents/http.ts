import { z } from "zod";
import { publicApi } from "@/lib/public-api/http";
import { parentConfig } from "@/modules/activities/shared/parents/config";

/** Request and response plumbing for the parent API: Core's public-API kit
 *  (src/lib/public-api/http.ts), worded for parents. */

export { idSchema, json } from "@/lib/public-api/http";
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const reasonSchema = z.string().trim().min(3).max(500);
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const api = publicApi({
  name: "Parent API",
  origins: () => parentConfig().origins,
  methods: "GET,POST,PATCH,OPTIONS",
  headers: "Authorization,Content-Type,Idempotency-Key",
  messages: { originDenied: "This app is not allowed to connect.", tooLarge: "The request is too large.", invalid: "Check the request fields." },
});

export const { parseInput, errorResponse, respond: parentResponse } = api;
/** Parent requests are always at most 16 KiB. */
export const readBody = <T extends z.ZodType>(request: Request, schema: T) => api.readBody(request, schema);
