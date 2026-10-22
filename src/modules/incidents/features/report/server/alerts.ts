import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { activeStaffWhoseRoleHolds, activeSuperadmins, siteName, staffAccess, staffSiteIds } from "@/lib/directory";
import { sendGoogleTextEmail } from "@/lib/email/google";
import { emailSender } from "@/lib/email/sender";
import { prisma } from "@/lib/prisma";
import { incidentCategories, incidentKinds, incidentNumber, type IncidentCategory, type IncidentKind } from "@/modules/incidents/shared/types";

/** Serious-report alerts (docs/incidents.md). Who gets one: the superadmin, and
 *  everyone whose own role has Incidents Manage (the operations manager) at the
 *  report's site (no sites ticked means every site). Nobody else: not Investigate,
 *  and not administrators through Admin: Manage (owner decision, 22 October 2026).
 *  The jobs are written in the report's transaction; sending happens straight
 *  after it commits, and each job keeps its outcome, so a failure shows on the
 *  report instead of disappearing. The email names no one and carries no injury
 *  details: those stay in Turnfin. */

export async function queueAlerts(tx: Prisma.TransactionClient, report: { id: string; siteId: string }) {
  const recipients = new Set((await activeSuperadmins(tx)).map((person) => person.id));
  for (const person of await activeStaffWhoseRoleHolds(["incidents.reports.signoff"], tx)) {
    const sites = await staffSiteIds(person.id, tx);
    if (sites.length === 0 || sites.includes(report.siteId)) recipients.add(person.id);
  }
  if (!recipients.size) {
    await tx.incidentNotification.create({ data: { reportId: report.id, recipientId: "unassigned", status: "FAILED", error: "Nobody's role has Incidents Manage at this site." } });
    return;
  }
  await tx.incidentNotification.createMany({ data: [...recipients].map((recipientId) => ({ reportId: report.id, recipientId })) });
}

function alertEmail(report: { id: string; number: number; kind: string; category: string; area: string; occurredOn: string; occurredAt: string }, site: string, origin: string) {
  const reference = incidentNumber(report.number);
  const what = incidentCategories[report.category as IncidentCategory]?.label ?? "Incident";
  const kind = incidentKinds[report.kind as IncidentKind]?.label ?? "Incident";
  const where = [site, report.area].filter(Boolean).join(", ");
  return {
    subject: `Serious ${kind.toLowerCase()} at ${site}: ${reference}`,
    text: `${kind} reported at ${where} on ${report.occurredOn} at ${report.occurredAt}: ${what}.\r\n\r\n`
      + `Open it in Turnfin to see what happened and who was involved:\r\n${origin}/incidents/${encodeURIComponent(report.id)}\r\n\r\n`
      + "Staff sign-in is required. Names and injury details are kept in Turnfin only.",
  };
}

export async function deliverAlerts(reportId: string, origin: string) {
  const report = await prisma.incidentReport.findUnique({ where: { id: reportId } });
  if (!report) return;
  const jobs = await prisma.incidentNotification.findMany({ where: { reportId, status: "PENDING" } });
  if (!jobs.length) return;
  const config = emailSender("Turnfin Incidents");
  const message = alertEmail(report, await siteName(report.siteId), origin);
  for (const job of jobs) {
    let status = "SENT", error: string | null = null;
    try {
      const person = await staffAccess(job.recipientId);
      if (!person?.isActive || !person.email) throw new Error("No active account with an email address.");
      if (!config) throw new Error("Email is not set up.");
      await sendGoogleTextEmail(person.email, message.subject, message.text, config);
    } catch (failure) {
      status = "FAILED";
      error = failure instanceof Error ? failure.message.slice(0, 300) : "Sending failed.";
    }
    await prisma.incidentNotification.update({ where: { id: job.id }, data: { status, error, sentAt: status === "SENT" ? new Date() : null } });
  }
}
