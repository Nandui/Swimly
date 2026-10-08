import { z } from "zod";
import type { GoogleEmailConfig } from "@/lib/email/google";

/** Turnfin's one outgoing email sender (Core; docs/architecture.md, "Core owns shared
 *  plumbing"). Every module that emails people outside the staff app (Turnfin Me, the
 *  Academy booking site, Refunds alerts) sends through this mailbox and passes only the
 *  name its email shows.
 *
 *  It reads TURNFIN_EMAIL_FROM and TURNFIN_GOOGLE_CLIENT_ID, _CLIENT_SECRET and
 *  _REFRESH_TOKEN, each falling back to the parent app's PARENT_* setting, which is what
 *  production runs on today. Null when the mailbox is not set up. The parent app keeps
 *  its own PARENT_* sender and name. */

const credential = z.string().trim().min(1).max(8192).regex(/^\S+$/);
const address = z.string().email().max(254);

/** A display name safe for a From header: no angle brackets, quotes or line breaks. */
const cleanName = (name: string) => name.replace(/[<>\r\n"]/g, "").trim().slice(0, 60);

export function emailSender(displayName: string, env: Record<string, string | undefined> = process.env): GoogleEmailConfig | null {
  const credentials = z.object({ clientId: credential, clientSecret: credential, refreshToken: credential }).safeParse({
    clientId: env.TURNFIN_GOOGLE_CLIENT_ID ?? env.PARENT_GOOGLE_CLIENT_ID,
    clientSecret: env.TURNFIN_GOOGLE_CLIENT_SECRET ?? env.PARENT_GOOGLE_CLIENT_SECRET,
    refreshToken: env.TURNFIN_GOOGLE_REFRESH_TOKEN ?? env.PARENT_GOOGLE_REFRESH_TOKEN,
  });
  const from = (env.TURNFIN_EMAIL_FROM ?? env.PARENT_EMAIL_FROM)?.trim() ?? "";
  // One mailbox only; configuration must never introduce MIME headers. A name in the
  // setting is ignored: each module names its own email.
  const named = /^([^<>\r\n]{1,60})\s*<([^<>\r\n]+)>$/.exec(from);
  const sender = address.safeParse(named ? named[2] : from);
  if (!credentials.success || !sender.success || /[\r\n]/.test(from)) return null;
  const name = cleanName(displayName);
  // Short encoded words keep each one inside the 75-character limit for any name.
  const encoded = name.match(/.{1,10}/gu)?.map((part) => `=?UTF-8?B?${Buffer.from(part).toString("base64")}?=`).join(" ");
  return { ...credentials.data, sender: sender.data, fromHeader: encoded ? `${encoded} <${sender.data}>` : sender.data };
}
