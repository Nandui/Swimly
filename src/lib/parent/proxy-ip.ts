import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";

/** Identifies a rate-limit source; never grants access to a parent account. */
export function signedParentIp(request: Request, secret = process.env.PARENT_PROXY_SECRET ?? "", now = Date.now()) {
  const ip = request.headers.get("x-parent-client-ip") ?? "", time = request.headers.get("x-parent-client-time") ?? "";
  const signature = request.headers.get("x-parent-client-signature") ?? "";
  if (secret.length < 32 || !isIP(ip) || !/^\d{13}$/.test(time) || Math.abs(now - Number(time)) > 60_000 || !/^[a-f0-9]{64}$/.test(signature)) return null;
  const url = new URL(request.url), value = [time, request.method, url.pathname + url.search, ip].join("\n");
  const expected = createHmac("sha256", secret).update(value).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex")) ? ip : null;
}
