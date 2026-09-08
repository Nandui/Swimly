import { createHash, timingSafeEqual } from "node:crypto";

export function validOperationToken(header: string | null, hash: string | undefined): boolean {
  if (!hash || !/^[a-f0-9]{64}$/.test(hash) || !header?.startsWith("Bearer ") || header.length > 200) return false;
  return timingSafeEqual(createHash("sha256").update(header.slice(7)).digest(), Buffer.from(hash, "hex"));
}
