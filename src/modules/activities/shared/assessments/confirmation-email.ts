import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { sendGoogleEmail } from "@/lib/email/google";
import { isSystemActor } from "@/lib/audit";
import { sitePhones, sitesByIds } from "@/lib/directory";
import { formatDay, formatTimeRange } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { readSharedCurriculum } from "@/modules/activities/shared/curriculum/data/shared";
import { parentEmailConfig } from "@/modules/activities/shared/parents/email";
import { PARENT_EMAIL_LOGO_CID } from "@/modules/activities/shared/parents/sign-in-email";

/** "Your assessment is booked": emailed to the family after any assessment
 *  booking, whether they booked it in the parents app or reception booked it
 *  (owner request, 24 October 2026). Sent from the parents app's mailbox, like
 *  the sign-in code.
 *
 *  Best effort and after the booking commits: the place is booked whether or
 *  not this arrives. Only the production deployment sends, because previews
 *  run on real families' records. Bookings by an account marked as system
 *  (scripted development work) send nothing. */

const address = z.string().email().max(254);

export type AssessmentConfirmation = {
  child: string; day: string; time: string; site: string; location: string | null;
  assessment: string; phone: string; bookedInApp: boolean;
};

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function assessmentConfirmationEmail(d: AssessmentConfirmation) {
  const where = d.location ? `${d.site} (${d.location})` : d.site;
  const details: [string, string][] = [["Swimmer", d.child], ["Assessment", d.assessment], ["Day", d.day], ["Time", d.time], ["Where", where]];
  const arrive = "Please arrive 10 minutes early, ready to swim.";
  const change = d.phone
    ? `If you need to change or cancel, please phone reception on ${d.phone}.`
    : `If you need to change or cancel, please contact reception at ${d.site}.`;
  const app = d.bookedInApp ? "You can also see this booking in the parents app under Bookings." : "";
  const lead = `${d.child}'s swimming assessment is booked. Here are the details.`;
  const text = [lead, details.map(([k, v]) => `${k}: ${v}`).join("\r\n"), arrive, change, app, "See you at the pool,\r\nThe LeisureWorld Aquatics team"]
    .filter(Boolean).join("\r\n\r\n");
  const rows = details.map(([k, v]) => `<tr><td class="email-muted" style="padding:6px 16px 6px 0;color:#475569;font-size:14px;line-height:22px;vertical-align:top;white-space:nowrap;">${k}</td>` +
    `<td class="email-copy" style="padding:6px 0;color:#111827;font-size:16px;line-height:22px;font-weight:600;">${escape(v)}</td></tr>`).join("\n");
  const para = (line: string) => `<p class="email-copy" style="margin:0 0 16px;color:#111827;font-size:16px;line-height:25px;">${escape(line)}</p>`;
  // Matches the parent sign-in email (sign-in-email.ts): email clients need
  // inline styles and literal colours rather than the app's CSS variables.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Assessment booked</title>
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
      .email-panel { background-color: #07345E !important; }
    }
  </style>
  <!--[if mso]><style>body, table, td, h1, p { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body class="email-page" style="margin:0;padding:0;background-color:#F8FAFC;font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827;-webkit-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escape(`${d.day}, ${d.time} at ${d.site}`)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-page" bgcolor="#F8FAFC" style="background-color:#F8FAFC;">
    <tr><td align="center" class="email-outer" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" bgcolor="#FFFFFF" style="max-width:560px;background-color:#FFFFFF;border:1px solid #D8E1E8;border-radius:16px;">
        <tr><td align="center" bgcolor="#07345E" style="padding:24px;background-color:#07345E;border-radius:15px 15px 0 0;">
          <img src="cid:${PARENT_EMAIL_LOGO_CID}" width="144" height="72" alt="LeisureWorld" style="display:block;width:144px;height:72px;border:0;color:#FFFFFF;font-size:20px;">
          <p style="margin:8px 0 0;color:#FFFFFF;font-size:16px;line-height:24px;font-weight:600;">Aquatics</p>
        </td></tr>
        <tr><td class="email-body" style="padding:36px 40px;">
          <h1 class="email-heading" style="margin:0 0 16px;color:#0B4F8A;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.5px;">Assessment booked</h1>
          ${para(lead)}
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
            <tr><td class="email-panel" bgcolor="#E5F0F8" style="padding:16px 20px;background-color:#E5F0F8;border-radius:12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
${rows}
              </table>
            </td></tr>
          </table>
          ${para(arrive)}
          ${para(change)}
          ${app ? para(app) : ""}
          <p class="email-copy" style="margin:8px 0 0;color:#111827;font-size:16px;line-height:25px;">See you at the pool,<br><strong>The LeisureWorld Aquatics team</strong></p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
      <p class="email-muted" style="margin:20px 0 0;color:#475569;font-size:14px;line-height:21px;">LeisureWorld Aquatics · Swimming assessments</p>
    </td></tr>
  </table>
</body>
</html>`;
  return { subject: `Assessment booked: ${d.child}, ${d.day}`, text, html };
}

/** Who hears about it: the parent who booked in the app; for a reception
 *  booking, the swimmer's contact email, or the parent accounts linked to
 *  them when it has none. */
async function recipients(booking: { student: { contactEmail: string | null; parentAccess: { parentEmail: string }[] } }, parentEmail?: string) {
  const list = parentEmail ? [parentEmail]
    : booking.student.contactEmail?.trim() ? [booking.student.contactEmail.trim()]
    : booking.student.parentAccess.map((a) => a.parentEmail);
  return [...new Set(list.map((e) => e.toLowerCase()))].filter((e) => address.safeParse(e).success && !/[\r\n]/.test(e)).slice(0, 3);
}

export async function sendAssessmentConfirmation(bookingId: string, by: { parentEmail: string } | { actorId: string }, env: Record<string, string | undefined> = process.env) {
  try {
    if (env.VERCEL_ENV !== "production") return;
    if ("actorId" in by && await isSystemActor(by.actorId)) return;
    const booking = await prisma.assessmentBooking.findUnique({ where: { id: bookingId }, select: {
      status: true,
      student: { select: { firstName: true, lastName: true, contactEmail: true, parentAccess: { where: { revokedAt: null }, select: { parentEmail: true } } } },
      session: { select: { date: true, startMinutes: true, durationMinutes: true, location: true, clubId: true, programmeId: true, typeId: true, cancelledAt: true } },
    } });
    if (!booking || booking.status !== "BOOKED" || booking.session.cancelledAt) return;
    const to = await recipients(booking, "parentEmail" in by ? by.parentEmail : undefined);
    if (!to.length) return;
    const { session } = booking;
    const [sites, phones, curriculum] = await Promise.all([sitesByIds([session.clubId]), sitePhones([session.clubId]), readSharedCurriculum()]);
    const type = session.typeId ? curriculum.types.find((t) => t.id === curriculum.typeIds.resolve(session.typeId!)) : null;
    const email = assessmentConfirmationEmail({
      child: booking.student.firstName, day: formatDay(session.date),
      time: formatTimeRange(session.startMinutes, session.startMinutes + session.durationMinutes),
      site: sites.get(session.clubId)?.name ?? "the pool", location: session.location?.trim() || null,
      assessment: type?.name ?? curriculum.programme(session.programmeId)?.name ?? "Swimming assessment",
      phone: phones.get(session.clubId)?.trim() ?? "", bookedInApp: "parentEmail" in by,
    });
    const config = parentEmailConfig();
    const logo = await readFile(join(process.cwd(), "assets/email/leisureworld-white-no-tagline.png"));
    for (const recipient of to) {
      await sendGoogleEmail(recipient, email.subject, { text: email.text, html: email.html, inlineImages: [{
        cid: PARENT_EMAIL_LOGO_CID, filename: "leisureworld.png", contentType: "image/png", content: logo,
      }] }, config);
    }
  } catch {
    // Provider responses can contain credentials: log the booking, not the error.
    console.error("Assessments: the booking confirmation email was not sent", { bookingId });
  }
}
