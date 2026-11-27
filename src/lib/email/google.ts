import { randomUUID } from "node:crypto";
import { z } from "zod";

export type GoogleEmailConfig = { clientId: string; clientSecret: string; refreshToken: string; sender: string; fromHeader: string };
export type GoogleEmailContent = {
  text: string;
  html?: string;
  inlineImages?: { cid: string; filename: string; content: Buffer; contentType: "image/png" }[];
  /** Where replies go, when not to the sending mailbox (e.g. the person who sent a purchase order). */
  replyTo?: string;
  /** Who gets a copy, shown to the recipient (e.g. managers copied on a purchase order). */
  cc?: string[];
};

function encodedPart(contentType: string, body: string | Buffer, headers: string[] = []) {
  return [
    `Content-Type: ${contentType}`, ...headers, "Content-Transfer-Encoding: base64", "",
    (Buffer.from(body).toString("base64").match(/.{1,76}/g) ?? []).join("\r\n"), "",
  ].join("\r\n");
}

function multipart(kind: "alternative" | "related", parts: string[]) {
  const boundary = `turnfin_${randomUUID()}`;
  return [`Content-Type: multipart/${kind}; boundary="${boundary}"`, "",
    ...parts.map(part => `--${boundary}\r\n${part}`), `--${boundary}--`, ""].join("\r\n");
}

function messageContent(content: GoogleEmailContent) {
  const plain = encodedPart("text/plain; charset=UTF-8", content.text);
  if (content.html === undefined) {
    if (content.inlineImages?.length) throw new Error("Inline images require an HTML body.");
    return plain;
  }
  const alternative = multipart("alternative", [plain, encodedPart("text/html; charset=UTF-8", content.html)]);
  if (!content.inlineImages?.length) return alternative;
  const images = content.inlineImages.map(image => {
    if (!/^[a-zA-Z0-9._@-]+$/.test(image.cid) || !/^[a-zA-Z0-9._-]+$/.test(image.filename) || image.contentType !== "image/png") {
      throw new Error("Inline image metadata is invalid.");
    }
    return encodedPart(image.contentType, image.content, [
      `Content-ID: <${image.cid}>`, `Content-Disposition: inline; filename="${image.filename}"`,
    ]);
  });
  return multipart("related", [alternative, ...images]);
}

/** Google's short reason code, when it has the shape of one: `invalid_grant` from the token
 *  endpoint, `RESOURCE_EXHAUSTED` from Gmail. Anything else (a message, an address) is dropped. */
export function refusalCode(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  const code = typeof error === "string" ? error : (error as { status?: unknown } | null)?.status;
  return typeof code === "string" && /^[A-Za-z_]{1,40}$/.test(code) ? code : null;
}

/** Callers hide provider errors from people, because a response can carry credentials. So the
 *  reason is logged here, as the step, the HTTP status and Google's reason code only. */
async function logRefusal(step: "authorisation" | "send", response: Response) {
  const code = refusalCode(await response.json().catch(() => null));
  console.error(`Email not sent: Google refused the ${step} step (${response.status}${code ? `, ${code}` : ""})`);
}

export async function sendGoogleTextEmail(email: string, subject: string, text: string, config: GoogleEmailConfig) {
  return sendGoogleEmail(email, subject, { text }, config);
}

/** Shared send-only transport. Callers provide their own copy and failure policy. */
export async function sendGoogleEmail(email: string, subject: string, content: GoogleEmailContent, config: GoogleEmailConfig) {
  const replyTo = content.replyTo;
  if (!z.string().email().safeParse(email).success || /[\r\n]/.test(email + subject + config.fromHeader)) throw new Error("Email configuration is invalid.");
  for (const extra of [replyTo, ...(content.cc ?? [])]) {
    if (extra !== undefined && (!z.string().email().safeParse(extra).success || /[\r\n]/.test(extra))) throw new Error("Email configuration is invalid.");
  }
  const message = [
    `From: ${config.fromHeader}`, `To: ${email}`, ...(content.cc?.length ? [`Cc: ${content.cc.join(", ")}`] : []), ...(replyTo ? [`Reply-To: ${replyTo}`] : []), `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`, `Message-ID: <${randomUUID()}@${config.sender.split("@")[1]}>`,
    "MIME-Version: 1.0", messageContent(content),
  ].join("\r\n");
  const signal = AbortSignal.timeout(10_000);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, refresh_token: config.refreshToken, grant_type: "refresh_token" }),
  });
  if (!tokenResponse.ok) {
    await logRefusal("authorisation", tokenResponse);
    throw new Error("Email provider unavailable.");
  }
  const token = z.object({ access_token: z.string().min(1).max(8192).regex(/^\S+$/), token_type: z.literal("Bearer"), scope: z.string().optional() }).safeParse(await tokenResponse.json());
  if (!token.success || (token.data.scope !== undefined && token.data.scope.trim() !== "https://www.googleapis.com/auth/gmail.send")) throw new Error("Email authorization unavailable.");
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST", cache: "no-store", redirect: "error", signal,
    headers: { Authorization: `Bearer ${token.data.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(message).toString("base64url") }),
  });
  if (!response.ok) {
    await logRefusal("send", response);
    throw new Error("Email submission failed.");
  }
  if (!z.object({ id: z.string().min(1) }).safeParse(await response.json()).success) throw new Error("Email submission failed.");
}
