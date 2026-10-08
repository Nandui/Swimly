import { z } from "zod";
import { sendGoogleEmail, type GoogleEmailConfig } from "@/lib/email/google";
import { unavailable } from "@/lib/academy/public/http";

/** Email for the booking site: the code that checks an address, and "your place is held".
 *  Sent through the same Google sender as the parent app (ACADEMY_* settings, falling back to
 *  PARENT_*). ACADEMY_EMAIL_NAME names the sender ("LeisureWorld Academy"). Outside production,
 *  ACADEMY_EMAIL_DEV_LOG=true prints them to the server console instead, for the sandbox. */

const credential = z.string().trim().min(1).max(8192).regex(/^\S+$/);
const address = z.string().email().max(254);

const devLog = (env = process.env) => env.NODE_ENV !== "production" && env.ACADEMY_EMAIL_DEV_LOG === "true";
export const senderName = (env = process.env) => (env.ACADEMY_EMAIL_NAME ?? "").replace(/[<>\r\n"]/g, "").trim().slice(0, 60) || "Academy";

function emailConfig(env = process.env): GoogleEmailConfig {
  const credentials = z.object({ clientId: credential, clientSecret: credential, refreshToken: credential }).safeParse({
    clientId: env.ACADEMY_GOOGLE_CLIENT_ID ?? env.PARENT_GOOGLE_CLIENT_ID,
    clientSecret: env.ACADEMY_GOOGLE_CLIENT_SECRET ?? env.PARENT_GOOGLE_CLIENT_SECRET,
    refreshToken: env.ACADEMY_GOOGLE_REFRESH_TOKEN ?? env.PARENT_GOOGLE_REFRESH_TOKEN,
  });
  const from = (env.ACADEMY_EMAIL_FROM ?? env.PARENT_EMAIL_FROM)?.trim() ?? "";
  const named = /^([^<>\r\n]{1,60})\s*<([^<>\r\n]+)>$/.exec(from);
  const sender = address.safeParse(named ? named[2] : from);
  if (!credentials.success || !sender.success || /[\r\n]/.test(from)) unavailable();
  return { ...credentials.data, sender: sender.data, fromHeader: `=?UTF-8?B?${Buffer.from(senderName(env)).toString("base64")}?= <${sender.data}>` };
}

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/* Poolside Clear v2 hex values, copied from src/app/docs/poolside.css (mail clients cannot read
   CSS variables), as in the Turnfin Me emails. */
const INK = "color:#0f1b2d", MUTED = "color:#56627a", BODY = "font-size:14px;line-height:20px";

function page(title: string, content: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escape(title)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .ac-page { background-color:#0c1320 !important; }
  .ac-panel { background-color:#131c2b !important; }
  .ac-ink { color:#e8eef7 !important; }
  .ac-muted { color:#9babc2 !important; }
}
</style>
</head>
<body class="ac-page" style="margin:0;padding:24px 16px;background-color:#eef2f6;font-family:'Plus Jakarta Sans',Arial,sans-serif;${INK};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="ac-page" style="background-color:#eef2f6"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="ac-panel" style="max-width:480px;background-color:#ffffff;border-radius:24px"><tr><td style="padding:32px 24px;text-align:left">
<p class="ac-ink" style="margin:0 0 24px;font-size:18px;line-height:24px;font-weight:600;${INK}">${escape(senderName())}</p>
${content}
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

export function codeEmail(code: string) {
  const digits = code.replace(/\D/g, "");
  const lead = "Use this code to book your place:";
  const keep = "It expires in 10 minutes. Nobody will ever ask you for this code.";
  const ignore = "If you did not ask for it, you can ignore this email.";
  return {
    text: `${lead} ${digits}\r\n\r\n${keep}\r\n\r\n${ignore}`,
    html: page("Your booking code", `<p class="ac-ink" style="margin:0 0 16px;${BODY};${INK}">${lead}</p>
<p class="ac-ink" style="margin:0 0 24px;font-size:28px;line-height:36px;font-weight:700;${INK};font-variant-numeric:tabular-nums;white-space:nowrap">${digits}</p>
<p class="ac-muted" style="margin:0 0 8px;${BODY};${MUTED}">${keep}</p>
<p class="ac-muted" style="margin:0;${BODY};${MUTED}">${ignore}</p>`),
  };
}

export type HeldDetails = { name: string; course: string; site: string; starts: string; reference: string; phone: string; callBy: string; price: string };

/** "Your place is held": what they booked, the reference, and that we will phone to take payment. */
export function heldEmail(d: HeldDetails) {
  const lines = [
    `Hello ${d.name},`,
    `Your place on ${d.course} at ${d.site}, starting ${d.starts}, is held.`,
    `We will phone you on ${d.phone} by ${d.callBy} to take payment of ${d.price}. Your place is confirmed once you have paid.`,
    "If we can't reach you within 72 hours, we may give the place to someone else. To change your number, reply to this email.",
  ];
  return {
    text: `${lines.join("\r\n\r\n")}\r\n\r\nReference: ${d.reference}`,
    html: page("Your place is held", `${lines.slice(0, 3).map((l) => `<p class="ac-ink" style="margin:0 0 16px;${BODY};${INK}">${escape(l)}</p>`).join("\n")}
<p class="ac-ink" style="margin:0 0 16px;${BODY};${INK}">Reference: <strong style="font-variant-numeric:tabular-nums">${escape(d.reference)}</strong></p>
<p class="ac-muted" style="margin:0;${BODY};${MUTED}">${escape(lines[3])}</p>`),
  };
}

function safeAddress(email: string) {
  if (!address.safeParse(email).success || /[\r\n]/.test(email)) unavailable();
}

export async function sendCode(email: string, code: string) {
  safeAddress(email);
  if (!/^\d{6}$/.test(code)) unavailable();
  if (devLog()) { console.log(`[academy] booking code for ${email}: ${code}`); return; }
  try { await sendGoogleEmail(email, "Your booking code", codeEmail(code), emailConfig()); }
  catch { unavailable(); }
}

/** Best effort: the place is held whether or not this arrives. */
export async function sendHeld(email: string, details: HeldDetails) {
  try {
    safeAddress(email);
    if (devLog()) { console.log(`[academy] place held email for ${email}: ${details.reference}`); return; }
    await sendGoogleEmail(email, `Your place is held: ${details.course}`, heldEmail(details), emailConfig());
  } catch {
    console.error("Academy: the place-held email was not sent", { reference: details.reference });
  }
}
