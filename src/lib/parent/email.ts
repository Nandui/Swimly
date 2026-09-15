import { randomUUID } from "node:crypto";
import { z } from "zod";
import { unavailable } from "@/lib/parent/errors";

const sendScope = "https://www.googleapis.com/auth/gmail.send";
const credential = z.string().trim().min(1).max(8192).regex(/^\S+$/);
const address = z.string().email().max(254);

export function parentEmailConfig() {
  const credentials = z.object({ clientId: credential, clientSecret: credential, refreshToken: credential }).safeParse({
    clientId: process.env.PARENT_GOOGLE_CLIENT_ID,
    clientSecret: process.env.PARENT_GOOGLE_CLIENT_SECRET,
    refreshToken: process.env.PARENT_GOOGLE_REFRESH_TOKEN,
  });
  const from = process.env.PARENT_EMAIL_FROM?.trim() ?? "";
  // Accept one mailbox only; configuration must never introduce MIME headers.
  const named = /^([^<>\r\n]{1,60})\s*<([^<>\r\n]+)>$/.exec(from);
  const sender = address.safeParse(named ? named[2] : from);
  if (!credentials.success || !sender.success || /[\r\n]/.test(from)) unavailable();
  const configuredName = named?.[1].trim();
  // Keep the authorised mailbox while upgrading the previous product display name.
  const name = configuredName === "Bookly" ? "LeisureWorld Aquatics" : configuredName;
  const encodedName = name?.match(/.{1,10}/gu)?.map(part => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join(" ");
  const fromHeader = encodedName ? `${encodedName} <${sender.data}>` : sender.data;
  return { ...credentials.data, sender: sender.data, fromHeader };
}

export async function sendParentSignInCode(email: string, code: string, config = parentEmailConfig()) {
  if (!address.safeParse(email).success || /[\r\n]/.test(email) || !/^\d{6}$/.test(code)) unavailable();
  // Both requests finish before the parent API responds. No background sends,
  // cross-request token cache, provider error bodies, or automatic send retries.
  const signal = AbortSignal.timeout(10_000);
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", cache: "no-store", redirect: "error", signal,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret,
        refresh_token: config.refreshToken, grant_type: "refresh_token" }),
    });
    if (!tokenResponse.ok) unavailable();
    const token = z.object({ access_token: credential, token_type: z.literal("Bearer"),
      scope: z.string().optional() }).safeParse(await tokenResponse.json());
    if (!token.success || (token.data.scope !== undefined && token.data.scope.trim() !== sendScope)) unavailable();

    const text = `Your LeisureWorld Aquatics sign-in code is ${code}.\r\n\r\nIt expires in 10 minutes. Do not share this code. If you did not request it, you can ignore this email.`;
    const message = [
      `From: ${config.fromHeader}`, `To: ${email}`, "Subject: Your LeisureWorld Aquatics parent sign-in code",
      `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@${config.sender.split("@")[1]}>`,
      "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "",
      Buffer.from(text).toString("base64").match(/.{1,76}/g)!.join("\r\n"), "",
    ].join("\r\n");
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST", cache: "no-store", redirect: "error", signal,
      headers: { Authorization: `Bearer ${token.data.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
    });
    if (!response.ok) unavailable();
    const receipt = z.object({ id: z.string().min(1) }).safeParse(await response.json());
    if (!receipt.success) unavailable();
  } catch {
    // Token and send errors may contain credentials or recipient data.
    unavailable();
  }
}
