import { allowedOrigins } from "@/lib/public-api/http";
import { unavailable } from "@/modules/activities/shared/parents/errors";

export function parentConfig() {
  const secret = process.env.PARENT_AUTH_SECRET ?? "";
  if (process.env.PARENT_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = allowedOrigins(process.env.PARENT_API_ALLOWED_ORIGINS) ?? unavailable();
  return { secret, origins };
}
