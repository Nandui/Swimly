import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { activeStaffAccess, staffAccess } from "@/lib/directory";
import { emailSender } from "@/lib/email/sender";
import { sendGoogleTextEmail } from "@/lib/email/google";
import { coinageRecipient, guardRead, lockCoinage } from "@/modules/coinage/shared/service";
import { coinageNumber, coinageStatuses, type CoinageActor, type CoinageStatus } from "@/modules/coinage/shared/types";

/** The staff app's address for links in alerts. Coinage shares Refunds' setting unless it has its own. */
const appUrl = () => process.env.COINAGE_APP_URL || process.env.REFUNDS_APP_URL || "";
function coinageEmail(number: number, status: string, id: string, base: string) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Set COINAGE_APP_URL (or REFUNDS_APP_URL) to the HTTPS staff app address.");
  const reference = coinageNumber(number);
  const label = coinageStatuses[status as CoinageStatus]?.label || "Updated";
  return { subject: `${reference}: ${label}`, text: `Coinage request ${reference} is now ${label.toLowerCase()}.\r\n\r\nOpen the request in Turnfin to see what needs to happen next:\r\n${url.origin}/coinage/${encodeURIComponent(id)}\r\n\r\nStaff sign-in is required. Please use Turnfin for replies and decisions.` };
}
/** Jobs are created in the workflow transaction; sending is deliberately outside it, as in
 *  Refunds. Each job is claimed, sent and its result audited. */
export async function deliverCoinageNotifications(requestId: string, who: CoinageActor, retry = false) {
  const request = await prisma.coinageRequest.findUnique({ where: { id: requestId } });
  guardRead(request, who);
  const jobs = await prisma.coinageNotification.findMany({ where: { requestId, status: { in: retry ? ["PENDING", "FAILED", "SENDING"] : ["PENDING"] } }, orderBy: { createdAt: "asc" }, take: 20, include: { event: true } });
  const audit = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], id: string, action: string, summary: string) =>
    logAudit({ actorId: who.id, actorName: who.name, entity: "CoinageNotification", entityId: id, clubId: request.clubId, action, summary: `${coinageNumber(request.number)}: ${summary}` }, tx);
  for (const job of jobs) {
    const claimed = await prisma.$transaction(async tx => {
      await lockCoinage(tx, requestId);
      const count = await tx.coinageNotification.updateMany({ where: { id: job.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "SENDING", attemptedAt: { lt: new Date(Date.now() - 120_000) } }] }, data: { status: "SENDING", attempts: { increment: 1 }, attemptedAt: new Date(), error: null } });
      if (count.count) await audit(tx, job.id, "email_attempt", "staff alert delivery attempted.");
      return count.count > 0;
    });
    if (!claimed) continue;
    let status = "SENT", error: string | null = null;
    try {
      if (job.recipientId === "unassigned") {
        // Reconcile a missing recipient after an administrator fixes access.
        const users = await activeStaffAccess(job.event.action === "submit" ? undefined : [request.creatorId]);
        const recipients = users.filter(user => coinageRecipient(user, request, job.event.action));
        if (!recipients.length) throw new Error("No eligible recipient");
        await prisma.$transaction(async tx => {
          for (const user of recipients) await tx.coinageNotification.upsert({ where: { eventId_recipientId: { eventId: job.eventId, recipientId: user.id } }, create: { eventId: job.eventId, requestId, recipientId: user.id }, update: {} });
          await audit(tx, job.id, "email_recipients", "staff alert recipients resolved.");
        });
        const resolved = await prisma.coinageNotification.findMany({ where: { eventId: job.eventId, status: "PENDING", recipientId: { not: "unassigned" }, id: { notIn: jobs.map(item => item.id) } }, include: { event: true }, take: Math.max(0, 20 - jobs.length) });
        jobs.push(...resolved);
        status = "SKIPPED";
      } else {
        const user = await staffAccess(job.recipientId);
        if (!user?.isActive || !coinageRecipient(user, request, job.event.action)) status = "SKIPPED";
        else {
          // Core's sender (src/lib/email/sender.ts); Coinage depends on no other module.
          const config = emailSender("Turnfin Coinage");
          if (!config) throw new Error("Email is not set up.");
          const snapshot = job.event.snapshot as { status: string };
          const message = coinageEmail(request.number, snapshot.status, request.id, appUrl());
          await sendGoogleTextEmail(user.email, message.subject, message.text, config);
        }
      }
    } catch {
      status = "FAILED";
      error = job.recipientId === "unassigned" ? "No eligible staff recipient. Check Coinage access, then retry." : "Email could not be confirmed. Check sender settings and retry; a previous alert may already have arrived.";
    }
    await prisma.$transaction(async tx => {
      await tx.coinageNotification.update({ where: { id: job.id }, data: { status, error, sentAt: status === "SENT" ? new Date() : null } });
      await audit(tx, job.id, "email_result", `staff alert ${status.toLowerCase()}.`);
    });
  }
  return await prisma.coinageNotification.count({ where: { requestId, status: { in: ["PENDING", "FAILED", "SENDING"] } } });
}
