import "server-only";
import { siteName, staffAccess } from "@/lib/directory";
import { sendGoogleEmail } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { incidentNumber } from "@/modules/incidents/shared/types";
import { hrRequestKind, recipientList } from "@/modules/incidents/features/wellbeing/rules";
import { wellbeingCopies } from "@/modules/incidents/features/wellbeing/server/settings";

/** The emails for asking HR ("Asking HR"). The request goes
 *  to each address in Incidents > Settings and says what kind it is, who asked,
 *  the site and the report number, and the link; who it is about and why are
 *  only behind the link. Replies go to whoever asked, who is copied in, as with
 *  CCTV footage, along with the Copy to addresses in Settings for every site
 *  and for the report's site (owner requests, 22 October 2026). When HR records something, whoever asked is told to look at
 *  the report, without what HR wrote. Outside production,
 *  INCIDENTS_EMAIL_DEV_LOG=true prints the emails to the server console instead. */

const devLog = (env = process.env) => env.NODE_ENV !== "production" && env.INCIDENTS_EMAIL_DEV_LOG === "true";

/** Emails the link to HR and records the outcome on the request. */
export async function sendWellbeingRequest(checkId: string, token: string, origin: string) {
  const c = await prisma.incidentWellbeingCheck.findUnique({ where: { id: checkId }, include: { report: { select: { number: true, siteId: true, orgId: true } } } });
  if (!c) return false;
  const failures: string[] = [];
  try {
    const config = emailSender("Turnfin Incidents");
    if (!config && !devLog()) throw new Error("Email is not set up.");
    const [site, asker, copies] = await Promise.all([siteName(c.report.siteId), staffAccess(c.requestedById), wellbeingCopies(c.report.orgId, c.report.siteId)]);
    const reference = incidentNumber(c.report.number);
    const inform = hrRequestKind(c.kind) === "inform";
    const subject = inform ? `Staff member in an incident at ${site}` : `Wellbeing check request from ${site}`;
    const text = "Hello,\r\n\r\n"
      + (inform
        ? `${c.requestedByName} at ${site} is letting HR know that a staff member was in incident ${reference}, in case HR needs to follow up.\r\n\r\n`
        : `${c.requestedByName} at ${site} is asking HR to check on someone's wellbeing after incident ${reference}.\r\n\r\n`)
      + `Open the link to see who it is about and why, and to record what you did, when, and what happens next. No sign-in is needed, and the link works until ${formatDate(c.expiresAt)}:\r\n${origin}/wellbeing/${token}\r\n\r\n`
      + "The link opens this one request and nothing else. It is private, so please don't forward it.\r\n\r\n"
      + `Reply to this email to reach ${c.requestedByName}.`;
    for (const to of recipientList(c.sentTo)) {
      const copied = [...new Set([asker?.email?.toLowerCase(), ...copies].filter((a): a is string => !!a && a !== to))];
      const cc = copied.length ? copied : undefined;
      try {
        if (devLog()) console.info(`[incidents email] to ${to}, cc ${cc?.join(", ") ?? "nobody"}: ${subject}\n${text}`);
        else if (config) await sendGoogleEmail(to, subject, { text, replyTo: asker?.email ?? undefined, cc }, config);
      } catch (failure) {
        failures.push(`${to}: ${failure instanceof Error ? failure.message : "sending failed"}`);
      }
    }
  } catch (failure) {
    failures.push(failure instanceof Error ? failure.message : "Sending failed.");
  }
  const error = failures.length ? failures.join("; ").slice(0, 300) : null;
  await prisma.incidentWellbeingCheck.update({ where: { id: checkId }, data: { emailedAt: error ? null : new Date(), emailError: error } });
  return !error;
}

/** Tells whoever asked that HR recorded something. Best effort: the report shows it either way. */
export async function sendWellbeingUpdated(checkId: string, finished: boolean, origin: string) {
  try {
    const c = await prisma.incidentWellbeingCheck.findUnique({ where: { id: checkId }, include: { report: { select: { id: true, number: true } } } });
    const config = emailSender("Turnfin Incidents");
    if (!c || (!config && !devLog())) return;
    const asker = await staffAccess(c.requestedById);
    if (!asker?.isActive || !asker.email) return;
    const reference = incidentNumber(c.report.number);
    const what = hrRequestKind(c.kind) === "inform" ? "request" : "wellbeing check";
    const subject = `HR ${finished ? "finished" : "updated"} the ${what} for ${reference}`;
    const text = `HR has ${finished ? "finished" : "recorded an update on"} the ${what} you sent on incident ${reference}.\r\n\r\n`
      + `Read it on the report:\r\n${origin}/incidents/${c.report.id}#inc-wellbeing-h\r\n\r\nStaff sign-in is required.`;
    if (devLog()) console.info(`[incidents email] to ${asker.email}: ${subject}\n${text}`);
    else if (config) await sendGoogleEmail(asker.email, subject, { text }, config);
  } catch {
    // The update is on the report whether or not this email goes.
  }
}
