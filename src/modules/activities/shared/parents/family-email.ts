import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { sendGoogleEmail } from "@/lib/email/google";
import { parentEmailConfig } from "@/modules/activities/shared/parents/email";
import { PARENT_EMAIL_LOGO_CID } from "@/modules/activities/shared/parents/sign-in-email";

/** One email to a swimmer's family, in the swim school's one look (the "Assessment booked" email
 *  and the failed payment warnings): the LeisureWorld Aquatics header, a heading, paragraphs, a
 *  panel of details, more paragraphs, the sign-off and a footer line. Sent from the parents app's
 *  mailbox, like the sign-in code. Email clients need inline styles and literal colours rather than
 *  the app's CSS variables, so they are here. */
export type FamilyEmail = {
  /** The browser tab title and the heading's words when no `heading` is given. */
  title: string;
  /** The inbox preview line. */
  preheader: string;
  heading?: string;
  /** info is the blue booking look; warn is amber and final is red, for payment reminders. */
  tone?: "info" | "warn" | "final";
  before: string[];
  details: [label: string, value: string][];
  after: string[];
  /** "See you at the pool," or "Thank you,". */
  signOff: string;
  footer: string;
};

const TONE = {
  info: { heading: "#0B4F8A", panel: "#E5F0F8", dark: "#07345E" },
  warn: { heading: "#B45309", panel: "#FEF3C7", dark: "#78350F" },
  final: { heading: "#B91C1C", panel: "#FEE2E2", dark: "#7F1D1D" },
} as const;

export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The plain-text version: paragraphs, details as "Label: value", then the sign-off. */
export function familyEmailText(e: FamilyEmail) {
  return [...e.before, e.details.map(([k, v]) => `${k}: ${v}`).join("\r\n"), ...e.after, `${e.signOff}\r\nThe LeisureWorld Aquatics team`]
    .filter(Boolean).join("\r\n\r\n");
}

export function familyEmailHtml(e: FamilyEmail) {
  const tone = TONE[e.tone ?? "info"];
  const rows = e.details.map(([k, v]) => `<tr><td class="email-muted" style="padding:6px 16px 6px 0;color:#475569;font-size:14px;line-height:22px;vertical-align:top;white-space:nowrap;">${escapeHtml(k)}</td>` +
    `<td class="email-copy" style="padding:6px 0;color:#111827;font-size:16px;line-height:22px;font-weight:600;">${escapeHtml(v)}</td></tr>`).join("\n");
  const para = (line: string) => `<p class="email-copy" style="margin:0 0 16px;color:#111827;font-size:16px;line-height:25px;">${escapeHtml(line)}</p>`;
  const paras = (lines: string[]) => lines.filter(Boolean).map(para).join("\n          ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(e.title)}</title>
  <style>
    @media (max-width: 480px) {
      .email-outer { padding: 16px 12px !important; }
      .email-body { padding: 28px 24px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .email-page, .email-card { background-color: #111827 !important; }
      .email-card { border-color: #475569 !important; }
      .email-heading, .email-copy { color: #E5F0F8 !important; }
      .email-muted { color: #D8E1E8 !important; }
      .email-panel { background-color: ${tone.dark} !important; }
    }
  </style>
  <!--[if mso]><style>body, table, td, h1, p { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body class="email-page" style="margin:0;padding:0;background-color:#F8FAFC;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(e.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr><td align="center" class="email-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" bgcolor="#FFFFFF" style="max-width:560px;background-color:#FFFFFF;border:1px solid #D8E1E8;border-radius:16px;">
        <tr><td align="center" bgcolor="#07345E" style="padding:24px;background-color:#07345E;border-radius:15px 15px 0 0;">
          <img src="cid:${PARENT_EMAIL_LOGO_CID}" width="144" height="72" alt="LeisureWorld" style="display:block;width:144px;height:72px;border:0;color:#FFFFFF;font-size:20px;">
          <p style="margin:8px 0 0;color:#FFFFFF;font-size:16px;line-height:24px;font-weight:600;">Aquatics</p>
        </td></tr>
        <tr><td class="email-body" style="padding:36px 40px;">
          <h1 class="email-heading" style="margin:0 0 16px;color:${tone.heading};font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.5px;">${escapeHtml(e.heading ?? e.title)}</h1>
          ${paras(e.before)}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
            <tr><td class="email-panel" bgcolor="${tone.panel}" style="padding:16px 20px;background-color:${tone.panel};border-radius:12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
${rows}
              </table>
            </td></tr>
          </table>
          ${paras(e.after)}
          <p class="email-copy" style="margin:8px 0 0;color:#111827;font-size:16px;line-height:25px;">${escapeHtml(e.signOff)}<br><strong>The LeisureWorld Aquatics team</strong></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p class="email-muted" style="margin:20px 0 0;color:#475569;font-size:14px;line-height:21px;">${escapeHtml(e.footer)}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Sends one family email from the parents app's mailbox, with the logo inline. Throws when the
 *  mailbox is not configured or the provider refuses; callers decide what that means. */
export async function sendFamilyEmail(to: string, subject: string, e: FamilyEmail) {
  const logo = await readFile(join(process.cwd(), "assets/email/leisureworld-white-no-tagline.png"));
  await sendGoogleEmail(to, subject, { text: familyEmailText(e), html: familyEmailHtml(e), inlineImages: [{
    cid: PARENT_EMAIL_LOGO_CID, filename: "leisureworld.png", contentType: "image/png", content: logo,
  }] }, parentEmailConfig());
}
