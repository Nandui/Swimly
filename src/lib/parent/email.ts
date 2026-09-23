import { sendGoogleTextEmail } from "@/lib/email/google";
import { z } from "zod";
import { unavailable } from "@/lib/parent/errors";

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
  try {
    const text = `Your LeisureWorld Aquatics sign-in code is ${code}.\r\n\r\nIt expires in 10 minutes. Do not share this code. If you did not request it, you can ignore this email.`;
    await sendGoogleTextEmail(email, "Your LeisureWorld Aquatics parent sign-in code", text, config);
  } catch {
    // Provider responses can contain credentials. Keep the parent API error safe.
    unavailable();
  }
}
