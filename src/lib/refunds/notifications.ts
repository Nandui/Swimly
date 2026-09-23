import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { parentEmailConfig } from "@/lib/parent/email";
import { sendGoogleTextEmail } from "@/lib/email/google";
import { refundAccess } from "@/lib/refunds/auth";
import { guardRead, lockRefund } from "@/lib/refunds/service";
import { refundNumber, refundStatuses, type RefundActor, type RefundStatus } from "@/lib/refunds/types";

export function refundEmail(number: number, status: string, id: string, base: string) {
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Set REFUNDS_APP_URL to the HTTPS staff app address.");
  const reference = refundNumber(number);
  const label = refundStatuses[status as RefundStatus]?.label || "Updated";
  return { subject: `${reference}: ${label}`, text: `${reference} is now ${label.toLowerCase()}.\r\n\r\nOpen the request in Turnfin to see what needs to happen next:\r\n${url.origin}/refunds/${encodeURIComponent(id)}\r\n\r\nStaff sign-in is required. Please use Turnfin for replies and decisions.` };
}
/** Jobs are created in the workflow transaction; sending is deliberately outside it.
 * No fire-and-forget task can disappear after the server returns. */
export async function deliverRefundNotifications(requestId: string, who: RefundActor, retry = false) {
  const request = await prisma.refundRequest.findUnique({ where: { id: requestId } });
  guardRead(request, who);
  const jobs = await prisma.refundNotification.findMany({ where: { requestId, status: { in: retry ? ["PENDING", "FAILED", "SENDING"] : ["PENDING"] } }, orderBy: { createdAt: "asc" }, take: 20, include: { event: true } });
  for (const job of jobs) {
    const claimed = await prisma.$transaction(async tx => {
      await lockRefund(tx, requestId);
      const count = await tx.refundNotification.updateMany({ where: { id: job.id, OR: [{ status: { in: ["PENDING", "FAILED"] } }, { status: "SENDING", attemptedAt: { lt: new Date(Date.now() - 120_000) } }] }, data: { status: "SENDING", attempts: { increment: 1 }, attemptedAt: new Date(), error: null } });
      if (count.count) await logAudit({ actorId: who.id, actorName: who.name, entity: "RefundNotification", entityId: job.id, clubId: request.clubId, action: "email_attempt", summary: `${refundNumber(request.number)}: staff alert delivery attempted.` }, tx);
      return count.count > 0;
    });
    if (!claimed) continue;
    let status = "SENT", error: string | null = null;
    try {
      if (job.recipientId === "unassigned") {
        // Reconcile a missing recipient after an administrator fixes access.
        const users = await prisma.user.findMany({ where: { isActive: true, ...(job.event.action === "submit" ? {} : { id: request.creatorId }) }, include: { staffRole: true } });
        const recipients = users.filter(user => {
          const role = user.staffRole;
          const access = role && refundAccess({ ...user, permissions: role.permissions, screens: role.screens });
          return access && (job.event.action !== "submit" || (access.review && user.id !== request.creatorId));
        });
        if (!recipients.length) throw new Error("No eligible recipient");
        await prisma.$transaction(async tx => {
          for (const user of recipients) await tx.refundNotification.upsert({ where: { eventId_recipientId: { eventId: job.eventId, recipientId: user.id } }, create: { eventId: job.eventId, requestId, recipientId: user.id }, update: {} });
          await logAudit({ actorId: who.id, actorName: who.name, entity: "RefundNotification", entityId: job.id, clubId: request.clubId, action: "email_recipients", summary: `${refundNumber(request.number)}: staff alert recipients resolved.` }, tx);
        });
        const resolved = await prisma.refundNotification.findMany({ where: { eventId: job.eventId, status: "PENDING", recipientId: { not: "unassigned" }, id: { notIn: jobs.map(item => item.id) } }, include: { event: true }, take: Math.max(0, 20 - jobs.length) });
        jobs.push(...resolved);
        status = "SKIPPED";
      } else {
        const user = await prisma.user.findUnique({ where: { id: job.recipientId }, include: { staffRole: true } });
        const access = user?.isActive && user.staffRole && refundAccess({ ...user, permissions: user.staffRole.permissions, screens: user.staffRole.screens });
        if (!user || !access || (job.event.action === "submit" && (!access.review || user.id === request.creatorId))) status = "SKIPPED";
        else {
          const config = parentEmailConfig();
          const snapshot = job.event.snapshot as { status: string };
          const message = refundEmail(request.number, snapshot.status, request.id, process.env.REFUNDS_APP_URL || "");
          await sendGoogleTextEmail(user.email, message.subject, message.text, { ...config, fromHeader: `Turnfin Refunds <${config.sender}>` });
        }
      }
    } catch {
      status = "FAILED";
      error = job.recipientId === "unassigned" ? "No eligible staff recipient. Check Refunds access, then retry." : "Email could not be confirmed. Check sender settings and retry; a previous alert may already have arrived.";
    }
    await prisma.$transaction(async tx => {
      await tx.refundNotification.update({ where: { id: job.id }, data: { status, error, sentAt: status === "SENT" ? new Date() : null } });
      await logAudit({ actorId: who.id, actorName: who.name, entity: "RefundNotification", entityId: job.id, clubId: request.clubId, action: "email_result", summary: `${refundNumber(request.number)}: staff alert ${status.toLowerCase()}.` }, tx);
    });
  }
  return await prisma.refundNotification.count({ where: { requestId, status: { in: ["PENDING", "FAILED", "SENDING"] } } });
}
