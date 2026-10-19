import "server-only";
import { siteName, staffAccess } from "@/lib/directory";
import { sendGoogleEmail } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { incidentNumber } from "@/modules/incidents/shared/types";

/** The footage emails (docs/incidents.md, "CCTV footage"). The request goes
 *  to whoever holds the footage, often outside the team, so it says what is
 *  needed and where to send it, and nothing about who was involved or what
 *  happened. Replies go to the person who asked. The confirmation goes to the
 *  person who asked when a video arrives. Failures are kept for the report.
 *  Outside production, INCIDENTS_EMAIL_DEV_LOG=true prints the request to the
 *  server console instead of sending it, for the sandbox. */

const devLog = (env = process.env) => env.NODE_ENV !== "production" && env.INCIDENTS_EMAIL_DEV_LOG === "true";

/** Emails the link and records the outcome on the request. */
export async function sendFootageRequest(requestId: string, token: string, origin: string) {
  const r = await prisma.incidentFootageRequest.findUnique({ where: { id: requestId }, include: { report: { select: { number: true, siteId: true } } } });
  if (!r) return false;
  let error: string | null = null;
  try {
    const config = emailSender("Turnfin Incidents");
    if (!config && !devLog()) throw new Error("Email is not set up.");
    const [site, asker] = await Promise.all([siteName(r.report.siteId), staffAccess(r.requestedById)]);
    const text = `Hello ${r.recipientName},\r\n\r\n`
      + `${r.requestedByName} at ${site} is asking you for CCTV footage for incident report ${incidentNumber(r.report.number)}.\r\n\r\n`
      + `What is needed:\r\n${r.details}\r\n\r\n`
      + `Upload it here. No sign-in is needed, and the link works until ${formatDate(r.expiresAt)}:\r\n${origin}/footage/${token}\r\n\r\n`
      + "Send the files as the recorder exports them (MP4, AVI, DAV, a zip and so on), up to 5 GB each. "
      + "The link only sends footage to this request: it shows nothing else, so please don't forward it.\r\n\r\n"
      + `If you can't get the footage, or it has already been overwritten, reply to this email to tell ${r.requestedByName}.`;
    const subject = `CCTV footage request from ${site}`;
    if (devLog()) console.info(`[incidents email] to ${r.recipientEmail}: ${subject}\n${text}`);
    else if (config) await sendGoogleEmail(r.recipientEmail, subject, { text, replyTo: asker?.email ?? undefined }, config);
  } catch (failure) {
    error = failure instanceof Error ? failure.message.slice(0, 300) : "Sending failed.";
  }
  await prisma.incidentFootageRequest.update({ where: { id: requestId }, data: { emailedAt: error ? null : new Date(), emailError: error } });
  return !error;
}

/** Tells the person who asked that a video arrived. Best effort: the report shows it either way. */
export async function sendFootageReceived(footageId: string, origin: string) {
  try {
    const f = await prisma.incidentFootage.findUnique({ where: { id: footageId }, include: { request: true, report: { select: { id: true, number: true } } } });
    const config = emailSender("Turnfin Incidents");
    if (!f || !config) return;
    const asker = await staffAccess(f.request.requestedById);
    if (!asker?.isActive || !asker.email) return;
    const reference = incidentNumber(f.report.number);
    await sendGoogleEmail(asker.email, `CCTV footage received for ${reference}`, {
      text: `${f.uploadedBy} has sent "${f.name}" for incident ${reference}, from your request to ${f.request.recipientName}.\r\n\r\n`
        + `${f.note ? `Their note: ${f.note}\r\n\r\n` : ""}Watch it on the report:\r\n${origin}/incidents/${f.report.id}#inc-footage-h\r\n\r\nStaff sign-in is required.`,
    }, config);
  } catch {
    // The video is on the report whether or not this email goes.
  }
}
