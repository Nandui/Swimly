import { randomUUID } from "node:crypto";
import { z } from "zod";

export type GoogleEmailConfig = { clientId: string; clientSecret: string; refreshToken: string; sender: string; fromHeader: string };
/** Shared send-only transport. Callers provide their own copy and failure policy. */
export async function sendGoogleTextEmail(email: string, subject: string, text: string, config: GoogleEmailConfig) {
  if (!z.string().email().safeParse(email).success || /[\r\n]/.test(email + subject + config.fromHeader)) throw new Error("Email configuration is invalid.");
  const signal = AbortSignal.timeout(10_000);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }),
  });
  if (!tokenResponse.ok) throw new Error("Email provider unavailable.");
  const token = z.object({ access_token: z.string().min(1).max(8192).regex(/^\S+$/), token_type: z.literal("Bearer"), scope: z.string().optional() }).safeParse(await tokenResponse.json());
  if (!token.success || (token.data.scope !== undefined && token.data.scope.trim() !== "https://www.googleapis.com/auth/gmail.send")) throw new Error("Email authorization unavailable.");
  const message = [
    `From: ${config.fromHeader}`, `To: ${email}`, `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@${config.sender.split("@")[1]}>`,
    "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
    Buffer.from(text).toString("base64").match(/.{1,76}/g)!.join("\r\n"), "",
  ].join("\r\n");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { Authorization: `Bearer ${token.data.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
  });
  if (!response.ok || !z.object({ id: z.string().min(1) }).safeParse(await response.json()).success) throw new Error("Email submission failed.");
}
