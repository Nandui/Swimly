import { z } from "zod";
import { PublicApiError, allowedOrigins, publicApi } from "@/lib/public-api/http";

/** Plumbing for the Academy booking API (/api/academy/v1): Core's public-API kit
 *  (src/lib/public-api/http.ts), worded for people booking a course.
 *
 *  It is off unless ACADEMY_API_ENABLED=true with ACADEMY_AUTH_SECRET of at least 32 characters.
 *  Browsers may call it only from the booking site's origins in ACADEMY_API_ALLOWED_ORIGINS
 *  (https, or http on localhost outside production). See docs/academy.md. */

export class AcademyApiError extends PublicApiError {}

export function unavailable(): never {
  throw new AcademyApiError(503, "UNAVAILABLE", "Online booking is not available right now. Try again later, or phone us.");
}
export function notFound(): never {
  throw new AcademyApiError(404, "NOT_FOUND", "That course is not open for booking.");
}

export function academyApiConfig(env: Record<string, string | undefined> = process.env) {
  const secret = env.ACADEMY_AUTH_SECRET ?? "";
  if (env.ACADEMY_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = allowedOrigins(env.ACADEMY_API_ALLOWED_ORIGINS, env) ?? unavailable();
  return { secret, origins, siteUrl: (env.ACADEMY_SITE_URL ?? origins[0] ?? "").replace(/\/$/, "") };
}

export { idSchema, json } from "@/lib/public-api/http";
export const emailSchema = z.string().trim().toLowerCase().email("Enter your email address.").max(254);

export const { readBody, parseInput, errorResponse, respond: academyResponse } = publicApi({
  name: "Academy API",
  origins: () => academyApiConfig().origins,
  methods: "GET,POST,OPTIONS",
  messages: { originDenied: "This site is not allowed to connect.", tooLarge: "That is too large to send.", invalid: "Check the details and try again." },
});
