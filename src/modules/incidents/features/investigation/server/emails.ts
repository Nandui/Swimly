import "server-only";
import { siteName, staffAccess } from "@/lib/directory";
import { addDaysIso, formatDate, today } from "@/lib/format";
import { sendGoogleTextEmail } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { prisma } from "@/lib/prisma";
import { incidentNumber } from "@/modules/incidents/shared/types";

/** Emails to an action's owner (docs/incidents.md): when it is given to them,
 *  the day before it is due and the day after it was due, once each. They
 *  carry the action's words and the report number, never who was hurt. A
 *  failure is kept on the action for the investigators to see. */

type Kind = "assigned" | "due" | "overdue";
const STAMP = { assigned: "assignedEmailAt", due: "dueEmailAt", overdue: "overdueEmailAt" } as const;

const day = (iso: string) => formatDate(new Date(`${iso}T12:00:00Z`));

export function actionEmail(kind: Kind, a: { reportId: string; title: string; dueOn: string; createdByName: string }, number: number, site: string, origin: string) {
  const reference = incidentNumber(number);
  const subject = {
    assigned: `An action for you from ${reference}`,
    due: `Due tomorrow: an action from ${reference}`,
    overdue: `Overdue: an action from ${reference}`,
  }[kind];
  const lead = {
    assigned: `${a.createdByName} has given you an action from incident ${reference} at ${site}, due by ${day(a.dueOn)}:`,
    due: `Your action from incident ${reference} at ${site} is due tomorrow, ${day(a.dueOn)}:`,
    overdue: `Your action from incident ${reference} at ${site} was due on ${day(a.dueOn)}:`,
  }[kind];
  return {
    subject,
    text: `${lead}\r\n\r\n${a.title}\r\n\r\n`
      + `When it is done, mark it done under Your actions in Turnfin Incidents, or tell whoever is investigating:\r\n${origin}/incidents#your-actions\r\n\r\n`
      + "Staff sign-in is required.",
  };
}

/** Sends one email about one action and records the outcome on it. */
export async function sendActionEmail(actionId: string, kind: Kind, origin: string) {
  const a = await prisma.incidentAction.findUnique({ where: { id: actionId }, include: { report: { select: { number: true, siteId: true } } } });
  if (!a || a.status !== "open") return false;
  let error: string | null = null;
  try {
    const person = await staffAccess(a.ownerId);
    if (!person?.isActive || !person.email) throw new Error(`${a.ownerName} has no active account with an email address.`);
    const config = emailSender("Turnfin Incidents");
    if (!config) throw new Error("Email is not set up.");
    const message = actionEmail(kind, a, a.report.number, await siteName(a.report.siteId), origin);
    await sendGoogleTextEmail(person.email, message.subject, message.text, config);
  } catch (failure) {
    error = failure instanceof Error ? failure.message.slice(0, 300) : "Sending failed.";
  }
  await prisma.incidentAction.update({ where: { id: actionId }, data: { [STAMP[kind]]: new Date(), emailError: error } });
  return !error;
}

/** The daily reminders (Vercel cron, /api/cron/incidents): open actions due
 *  tomorrow, and open actions whose due day has passed. Each email goes once,
 *  so running it twice in a day sends nothing new. */
export async function runActionReminders(origin: string, now = new Date()) {
  const day = today(now), tomorrow = addDaysIso(day, 1);
  const [due, overdue] = await Promise.all([
    prisma.incidentAction.findMany({ where: { status: "open", dueOn: tomorrow, dueEmailAt: null }, select: { id: true } }),
    prisma.incidentAction.findMany({ where: { status: "open", dueOn: { lt: day }, overdueEmailAt: null }, select: { id: true } }),
  ]);
  let sent = 0, failed = 0;
  for (const [kind, rows] of [["due", due], ["overdue", overdue]] as const) {
    for (const row of rows) {
      if (await sendActionEmail(row.id, kind, origin)) sent++;
      else failed++;
    }
  }
  return { sent, failed };
}
