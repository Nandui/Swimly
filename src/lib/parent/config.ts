import { unavailable } from "@/lib/parent/errors";

export function parentConfig() {
  const secret = process.env.PARENT_AUTH_SECRET ?? "";
  if (process.env.PARENT_API_ENABLED !== "true" || secret.length < 32) unavailable();
  const origins = (process.env.PARENT_API_ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  for (const origin of origins) {
    let url: URL;
    try { url = new URL(origin); } catch { unavailable(); }
    if (url.origin !== origin || (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" &&
      url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)))) unavailable();
  }
  return { secret, origins };
}
