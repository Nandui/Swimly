import { createHmac, randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parentConfig } from "@/lib/parent/config";
import { ParentApiError } from "@/lib/parent/errors";
import { signedParentIp } from "@/lib/parent/proxy-ip";

export function opaqueToken() { return randomBytes(32).toString("base64url"); }
export function digest(value: string) { return createHmac("sha256", parentConfig().secret).update(value).digest("hex"); }

/** Counters commit independently of failed login/booking transactions. */
export async function rateLimit(bucket: string, maximum: number, seconds: number) {
  const now = new Date();
  const key = digest(`rate:${bucket}`);
  const cutoff = new Date(now.getTime() - seconds * 1000);
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "ParentRateLimit" (key,"windowStart",count) VALUES (${key},${now},1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "ParentRateLimit".count + 1 END,
      "windowStart" = CASE WHEN "ParentRateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "ParentRateLimit"."windowStart" END
    RETURNING count`;
  if (rows[0].count > maximum) throw new ParentApiError(429, "RATE_LIMITED", "Too many attempts. Please try again later.");
}

/** Only Vercel's overwritten IP header is trusted. Other deployments use one
 * shared anonymous bucket unless their proxy is configured to overwrite it. */
export function requestIp(request: Request) {
  const forwarded = signedParentIp(request);
  if (forwarded) return forwarded;
  return process.env.VERCEL === "1" || process.env.PARENT_TRUST_PROXY_IP === "true"
    ? (request.headers.get("x-real-ip") ?? "unknown").slice(0, 100) : "anonymous";
}

export async function lockParent(tx: Prisma.TransactionClient, email: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`parent:${email}`}))`;
}
