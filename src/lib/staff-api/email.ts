import { z } from "zod";
import { sendGoogleEmail, type GoogleEmailConfig } from "@/lib/email/google";
import { unavailable } from "@/lib/staff-api/errors";

/** Email for Turnfin Me: sign-in codes and reminders, through the same Google
 *  sender as the parent app (STAFF_* settings, falling back to PARENT_*).
 *  Outside production, STAFF_EMAIL_DEV_LOG=true prints codes to the server
 *  console instead, for the local sandbox; it is ignored in production. */

const credential = z.string().trim().min(1).max(8192).regex(/^\S+$/);
const address = z.string().email().max(254);

function devLog(env = process.env) {
  return env.NODE_ENV !== "production" && env.STAFF_EMAIL_DEV_LOG === "true";
}

export function staffEmailConfig(env = process.env): GoogleEmailConfig {
  const credentials = z.object({ clientId: credential, clientSecret: credential, refreshToken: credential }).safeParse({
    clientId: env.STAFF_GOOGLE_CLIENT_ID ?? env.PARENT_GOOGLE_CLIENT_ID,
    clientSecret: env.STAFF_GOOGLE_CLIENT_SECRET ?? env.PARENT_GOOGLE_CLIENT_SECRET,
    refreshToken: env.STAFF_GOOGLE_REFRESH_TOKEN ?? env.PARENT_GOOGLE_REFRESH_TOKEN,
  });
  const from = (env.STAFF_EMAIL_FROM ?? env.PARENT_EMAIL_FROM)?.trim() ?? "";
  const named = /^([^<>\r\n]{1,60})\s*<([^<>\r\n]+)>$/.exec(from);
  const sender = address.safeParse(named ? named[2] : from);
  if (!credentials.success || !sender.success || /[\r\n]/.test(from)) unavailable();
  const name = "Turnfin Me";
  const encodedName = `=?UTF-8?B?${Buffer.from(name).toString("base64")}?=`;
  return { ...credentials.data, sender: sender.data, fromHeader: `${encodedName} <${sender.data}>` };
}

function safeAddress(email: string) {
  if (!address.safeParse(email).success || /[\r\n]/.test(email)) unavailable();
}

export async function sendStaffCode(email: string, code: string, purpose: "sign-in" | "confirm") {
  safeAddress(email);
  if (!/^\d{6}$/.test(code)) unavailable();
  if (devLog()) { console.log(`[turnfin-me] ${purpose} code for ${email}: ${code}`); return; }
  const subject = purpose === "confirm" ? "Your Turnfin Me confirmation code" : "Your Turnfin Me sign-in code";
  const lead = purpose === "confirm" ? "Use this code to open your HR records in Turnfin Me:" : "Use this code to sign in to Turnfin Me:";
  const text = `${lead} ${code}\r\n\r\nIt expires in 10 minutes. Keep it private: nobody from LeisureWorld will ask you for it.\r\n\r\nIf you did not ask for it, you can ignore this email.`;
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;background:#f4f8f9;font-family:Arial,sans-serif;color:#0f2a33">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 16px;font-size:16px">${lead}</p>
<p style="margin:0 0 24px;font-size:36px;font-weight:700;letter-spacing:8px;color:#0a5d80">${code}</p>
<p style="margin:0 0 8px;font-size:14px;color:#4c6770">It expires in 10 minutes. Keep it private: nobody from LeisureWorld will ask you for it.</p>
<p style="margin:0;font-size:14px;color:#4c6770">If you did not ask for it, you can ignore this email.</p>
</div></body></html>`;
  try { await sendGoogleEmail(email, subject, { text, html }, staffEmailConfig()); }
  catch { unavailable(); }
}

/** A reminder: a short line and a link to Turnfin Me. Never HR content. */
export async function sendStaffReminder(email: string, subject: string, line: string, link: string) {
  safeAddress(email);
  if (devLog()) { console.log(`[turnfin-me] reminder for ${email}: ${subject}`); return; }
  const text = `${line}\r\n\r\nOpen Turnfin Me: ${link}\r\n\r\nYou can turn reminders off in Turnfin Me under Reminders.`;
  const html = `<!DOCTYPE html><html lang="en"><body style="margin:0;padding:24px;background:#f4f8f9;font-family:Arial,sans-serif;color:#0f2a33">
<div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 24px;font-size:16px">${line.replace(/[<>&]/g, "")}</p>
<p style="margin:0 0 24px"><a href="${encodeURI(link)}" style="display:inline-block;background:#0a5d80;color:#ffffff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Open Turnfin Me</a></p>
<p style="margin:0;font-size:13px;color:#4c6770">You can turn reminders off in Turnfin Me under Reminders.</p>
</div></body></html>`;
  await sendGoogleEmail(email, subject, { text, html }, staffEmailConfig());
}
