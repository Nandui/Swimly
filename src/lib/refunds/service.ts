import type { Prisma, RefundRequest } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { refundAccess } from "@/lib/refunds/auth";
import { commandSchema, parseFields, RefundError, transition, type RefundCommand } from "@/lib/refunds/rules";
import { canReadRefund, refundActions, refundNumber, type RefundActor } from "@/lib/refunds/types";

export async function lockRefund(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`refund:${id}`}, 0))`;
}
export function guardRead(row: RefundRequest | null, who: RefundActor): asserts row is RefundRequest {
  if (!row || !canReadRefund(row, who)) throw new RefundError("This refund request is not available.");
}
export function guardVersion(row: RefundRequest, version: number) {
  if (row.version !== version) throw new RefundError("This request changed while you were working. Refresh the page before trying again; your entries have been kept.");
}
export const receiptSelect = { id: true, name: true, mime: true, size: true, removedAt: true } as const;
export async function recordEvent(tx: Prisma.TransactionClient, row: RefundRequest, who: RefundActor, action: string, operationId: string, note = "") {
  const receipts = await tx.refundAttachment.findMany({ where: { requestId: row.id, removedAt: null }, select: receiptSelect });
  const snapshot = JSON.parse(JSON.stringify({ ...row, receipts }));
  const event = await tx.refundEvent.create({ data: { requestId: row.id, actorId: who.id, actorName: who.name, action, operationId, note, snapshot } });
  await logAudit({ actorId: who.id, actorName: who.name, entity: "RefundRequest", entityId: row.id, clubId: row.clubId, action, summary: `${refundNumber(row.number)}: ${refundActions[action as keyof typeof refundActions] || action}.` }, tx);
  return event;
}
async function queueNotifications(tx: Prisma.TransactionClient, row: RefundRequest, eventId: string, action: string) {
  if (!["submit", "information", "approve", "decline", "pay", "cancel"].includes(action)) return;
  const users = await tx.user.findMany({ where: { isActive: true, ...(action === "submit" ? {} : { id: row.creatorId }) }, include: { staffRole: true } });
  const recipients = users.filter(user => {
    if (!user.staffRole) return false;
    const access = refundAccess({ ...user, permissions: user.staffRole.permissions, screens: user.staffRole.screens });
    return !!access && (action !== "submit" || (access.review && user.id !== row.creatorId));
  });
  // A sentinel makes missing finance setup visible and retryable after grants change.
  for (const recipientId of recipients.length ? recipients.map(user => user.id) : ["unassigned"]) {
    await tx.refundNotification.create({ data: { requestId: row.id, eventId, recipientId } });
  }
}
function guardAction(who: RefundActor, action: string) {
  const allowed = ["save", "submit", "withdraw"].includes(action) ? who.request
    : action === "pay" ? who.process : ["claim", "cancel"].includes(action) ? who.review || who.process : who.review;
  if (!allowed) throw new RefundError("You do not have permission for this refund action.");
}
export async function mutateRefund(who: RefundActor, input: RefundCommand) {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new RefundError(parsed.error.issues[0].message);
  const command = parsed.data;
  guardAction(who, command.action);
  return prisma.$transaction(async tx => {
    await lockRefund(tx, command.id);
    let row = await tx.refundRequest.findUnique({ where: { id: command.id } });
    if (row) {
      guardRead(row, who);
      const replay = await tx.refundEvent.findUnique({ where: { requestId_operationId: { requestId: row.id, operationId: command.operationId } } });
      if (replay) {
        if (replay.actorId !== who.id || replay.action !== command.action) throw new RefundError("This action reference has already been used.");
        return row;
      }
      guardVersion(row, command.version);
    } else if (command.version !== 0 || !["save", "submit"].includes(command.action)) throw new RefundError("This refund request is not available.");

    if (command.action === "save" || command.action === "submit") {
      const data = parseFields(command.fields, command.action === "submit");
      const club = await tx.club.findFirst({ where: { id: data.clubId, archivedAt: null }, select: { id: true, name: true } });
      if (!club) throw new RefundError("Choose an active site.");
      const base = row ?? { status: "DRAFT", creatorId: who.id, requestedCents: null, approvedCents: null, paymentDate: "" };
      const update = transition(base, who, command);
      const changed = { ...data, ...update, clubName: club.name, ...(command.action === "submit" ? { submittedAt: new Date() } : {}) };
      row = row ? await tx.refundRequest.update({ where: { id: row.id }, data: { ...changed, version: { increment: 1 } } })
        : await tx.refundRequest.create({ data: { ...changed, id: command.id, creatorId: who.id, creatorName: who.name } });
    } else {
      guardRead(row, who);
      row = await tx.refundRequest.update({ where: { id: row.id }, data: { ...transition(row, who, command), version: { increment: 1 } } });
    }
    const event = await recordEvent(tx, row, who, command.action, command.operationId, command.note);
    await queueNotifications(tx, row, event.id, command.action);
    return row;
  });
}
