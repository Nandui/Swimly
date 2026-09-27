import { createHmac, randomBytes, randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { staffApiConfig } from "@/lib/staff-api/config";
import { StaffApiError } from "@/lib/staff-api/errors";

export function opaqueToken() { return randomBytes(32).toString("base64url"); }
export function sixDigitCode() { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
export function digest(value: string) { return createHmac("sha256", staffApiConfig().secret).update(value).digest("hex"); }

/** Counters commit on their own, so a failed sign-in still counts. They share
 *  the parent API's counter table; keys are hashed with the staff secret and
 *  prefixed, so the two never collide. */
export async function rateLimit(bucket: string, maximum: number, seconds: number) {
  const now = new Date();
  const key = digest(`staff-rate:${bucket}`);
  const cutoff = new Date(now.getTime() - seconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ParentRateLimit" (key,"windowStart",count) VALUES (${key},${now},1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "ParentRateLimit".count + 1 END,
      "windowStart" = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "ParentRateLimit"."windowStart" END
    RETURNING count`;
  if (rows[0].count > maximum) throw new StaffApiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
}

/** Only Vercel's overwritten IP header is trusted; elsewhere one shared bucket. */
export function requestIp(request: Request) {
  return process.env.VERCEL === "1" ? (request.headers.get("x-real-ip") ?? "unknown").slice(0, 100) : "anonymous";
}
