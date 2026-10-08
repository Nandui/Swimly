import { z } from "zod";
import { sendGoogleEmail, type GoogleEmailConfig } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { staffApiConfig } from "@/lib/staff-api/config";
import { unavailable } from "@/lib/staff-api/errors";

/** Email for Turnfin Me: sign-in codes and reminders, through Core's sender
 *  (src/lib/email/sender.ts) as "Turnfin Me".
 *  Outside production, STAFF_EMAIL_DEV_LOG=true prints codes to the server
 *  console instead, for the local sandbox; it is ignored in production. */

const address = z.string().email().max(254);

function devLog(env = process.env) {
  return env.NODE_ENV !== "production" && env.STAFF_EMAIL_DEV_LOG === "true";
}

export function staffEmailConfig(env = process.env): GoogleEmailConfig {
  return emailSender("Turnfin Me", env) ?? unavailable();
}

function safeAddress(email: string) {
  if (!address.safeParse(email).success || /[\r\n]/.test(email)) unavailable();
}

/** The fin for the email header: Turnfin Me's own icon, served without sign-in at STAFF_ME_URL.
 *  Only an https address is used (mail clients will not load http or localhost images), and this
 *  never throws: with the staff API off or no address, the email simply has no fin. */
function finSrc(): string {
  let base = "";
  try { base = staffApiConfig().meUrl; } catch { /* no address: no fin */ }
  return base.startsWith("https://") ? `${base}/icon-192.png` : "";
}

/* The emails in Poolside Clear v2. Mail clients cannot read CSS variables, so the light and dark
   hex values are copied from src/app/docs/poolside.css (canvas, surface, ink, ink-muted, primary,
   on-primary); keep them in step. Sizes stay on the v2 scale: 12, 14, 18 and 28px. */
const INK = "color:#0f1b2d";
const MUTED = "color:#56627a";
const BODY = "font-size:14px;line-height:20px";

/** The shared page: the canvas, one white 24px panel, the fin and "Turnfin Me" on top (the name
 *  still reads when images are blocked), then the message. The fin file has transparent margins,
 *  so it is drawn 64px, as on Me's own 64px brand tile. Dark mode swaps in the v2 dark values. */
function emailPage(title: string, content: string, fin: string) {
  const mark = fin
    ? `<td style="padding:0 8px 0 0;vertical-align:middle"><img src="${encodeURI(fin)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border:0"></td>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<style>
@media (prefers-color-scheme: dark) {
  .tm-page { background-color:#0c1320 !important; }
  .tm-panel { background-color:#131c2b !important; }
  .tm-ink { color:#e8eef7 !important; }
  .tm-muted { color:#9babc2 !important; }
  .tm-button { background-color:#78a6ff !important; color:#081733 !important; }
}
</style>
</head>
<body class="tm-page" style="margin:0;padding:24px 16px;background-color:#eef2f6;font-family:'Plus Jakarta Sans',Arial,sans-serif;${INK};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="tm-page" style="background-color:#eef2f6"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="tm-panel" style="max-width:480px;background-color:#ffffff;border-radius:24px"><tr><td style="padding:32px 24px;text-align:left">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px"><tr>${mark}<td class="tm-ink" style="vertical-align:middle;font-size:18px;line-height:24px;font-weight:600;${INK}">Turnfin Me</td></tr></table>
${content}
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

/** The sign-in or HR confirmation code email. Plain arguments only; never throws. */
export function staffCodeEmail(code: string, purpose: "sign-in" | "confirm", fin: string) {
  const digits = code.replace(/\D/g, "");
  const title = purpose === "confirm" ? "Your Turnfin Me confirmation code" : "Your Turnfin Me sign-in code";
  const lead = purpose === "confirm" ? "Use this code to open your HR records in Turnfin Me:" : "Use this code to sign in to Turnfin Me:";
  const keep = "It expires in 10 minutes. Nobody will ever ask you for this code.";
  const ignore = "If you did not ask for it, you can ignore this email.";
  return {
    text: `${lead} ${digits}\r\n\r\n${keep}\r\n\r\n${ignore}`,
    html: emailPage(title, `<p class="tm-ink" style="margin:0 0 16px;${BODY};${INK}">${lead}</p>
<p class="tm-ink" style="margin:0 0 24px;font-size:28px;line-height:36px;font-weight:700;${INK};font-variant-numeric:tabular-nums;white-space:nowrap">${digits}</p>
<p class="tm-muted" style="margin:0 0 8px;${BODY};${MUTED}">${keep}</p>
<p class="tm-muted" style="margin:0;${BODY};${MUTED}">${ignore}</p>`, fin),
  };
}

/** A reminder email: a short line and a 44px pill to open Turnfin Me. Never HR content. */
export function staffReminderEmail(line: string, link: string, fin: string) {
  const footnote = "You can turn reminders off in Turnfin Me under Reminders.";
  return {
    text: `${line}\r\n\r\nOpen Turnfin Me: ${link}\r\n\r\n${footnote}`,
    html: emailPage("Turnfin Me", `<p class="tm-ink" style="margin:0 0 24px;${BODY};${INK}">${line.replace(/[<>&]/g, "")}</p>
<p style="margin:0 0 24px"><a class="tm-button" href="${encodeURI(link)}" style="display:inline-block;background-color:#1d5fd1;color:#ffffff;font-size:14px;line-height:20px;font-weight:600;padding:12px 24px;border-radius:999px;text-decoration:none">Open Turnfin Me</a></p>
<p class="tm-muted" style="margin:0;font-size:12px;line-height:16px;${MUTED}">${footnote}</p>`, fin),
  };
}

export async function sendStaffCode(email: string, code: string, purpose: "sign-in" | "confirm") {
  safeAddress(email);
  if (!/^\d{6}$/.test(code)) unavailable();
  if (devLog()) { console.log(`[turnfin-me] ${purpose} code for ${email}: ${code}`); return; }
  const subject = purpose === "confirm" ? "Your Turnfin Me confirmation code" : "Your Turnfin Me sign-in code";
  try { await sendGoogleEmail(email, subject, staffCodeEmail(code, purpose, finSrc()), staffEmailConfig()); }
  catch { unavailable(); }
}

/** A reminder: a short line and a link to Turnfin Me. Never HR content. */
export async function sendStaffReminder(email: string, subject: string, line: string, link: string) {
  safeAddress(email);
  if (devLog()) { console.log(`[turnfin-me] reminder for ${email}: ${subject}`); return; }
  await sendGoogleEmail(email, subject, staffReminderEmail(line, link, finSrc()), staffEmailConfig());
}
