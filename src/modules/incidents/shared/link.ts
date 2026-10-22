import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** An emailed link's secret, for CCTV footage requests and wellbeing checks:
 *  32 random bytes in the link, only their hash in the database. */
export function newLinkToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
