import type { CoinageRequest, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { activeStaffAccess, liveSiteById } from "@/lib/directory";
import { coinageAccess } from "@/modules/coinage/shared/auth";
import { commandSchema, CoinageError, parseFields, transition, type CoinageCommand } from "@/modules/coinage/shared/rules";
import { canReadCoinage, coinageActions, coinageNumber, euros, type CoinageActor } from "@/modules/coinage/shared/types";

export async function lockCoinage(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`coinage:${id}`}, 0))`;
}
export function guardRead(row: CoinageRequest | null, who: CoinageActor): asserts row is CoinageRequest {
  if (!row || !canReadCoinage(row, who)) throw new CoinageError("This coinage request is not available.");
}
function guardVersion(row: CoinageRequest, version: number) {
  if (row.version !== version) throw new CoinageError("This request changed while you were working. Refresh the page before trying again; your entries have been kept.");
}
async function recordEvent(tx: Prisma.TransactionClient, row: CoinageRequest, who: CoinageActor, action: string, operationId: string, note = "") {
  const snapshot = JSON.parse(JSON.stringify(row));
  const event = await tx.coinageEvent.create({ data: { requestId: row.id, actorId: who.id, actorName: who.name, action, operationId, note, snapshot } });
  const label = coinageActions[action as keyof typeof coinageActions] || action;
  await logAudit({ actorId: who.id, actorName: who.name, entity: "CoinageRequest", entityId: row.id, clubId: row.clubId, action, summary: `${coinageNumber(row.number)} (${euros(row.totalCents)}): ${label}.` }, tx);
  return event;
}
/** Who hears about a step: accounts (everyone who decides, bar the requester) when it is sent,
 *  the requester for everything after. */
export function coinageRecipient(user: { id: string; rolePermissions: readonly string[] | null }, row: { creatorId: string }, action: string) {
  if (!user.rolePermissions) return false;
  const access = coinageAccess({ ...user, permissions: user.rolePermissions });
  return !!access && (action !== "submit" || (access.review && user.id !== row.creatorId));
}
async function queueNotifications(tx: Prisma.TransactionClient, row: CoinageRequest, eventId: string, action: string) {
  if (!["submit", "information", "approve", "decline", "order", "cancel"].includes(action)) return;
  const users = await activeStaffAccess(action === "submit" ? undefined : [row.creatorId], tx);
  const recipients = users.filter(user => coinageRecipient(user, row, action));
  // A sentinel makes missing accounts setup visible and retryable after roles change.
  for (const recipientId of recipients.length ? recipients.map(user => user.id) : ["unassigned"]) {
    await tx.coinageNotification.create({ data: { requestId: row.id, eventId, recipientId } });
  }
}
function guardAction(who: CoinageActor, action: string) {
  const allowed = ["save", "submit", "withdraw"].includes(action) ? who.request
    : action === "order" ? who.process : ["claim", "cancel"].includes(action) ? who.review || who.process : who.review;
  if (!allowed) throw new CoinageError("You do not have permission for this step.");
}
/** Every change to a request: locked, version-checked, replay-safe, with its history row, audit
 *  row and email jobs written in the same transaction. */
export async function mutateCoinage(who: CoinageActor, input: CoinageCommand) {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new CoinageError(parsed.error.issues[0].message);
  const command = parsed.data;
  guardAction(who, command.action);
  return prisma.$transaction(async tx => {
    await lockCoinage(tx, command.id);
    let row = await tx.coinageRequest.findUnique({ where: { id: command.id } });
    if (row) {
      guardRead(row, who);
      const replay = await tx.coinageEvent.findUnique({ where: { requestId_operationId: { requestId: row.id, operationId: command.operationId } } });
      if (replay) {
        if (replay.actorId !== who.id || replay.action !== command.action) throw new CoinageError("This action reference has already been used.");
        return row;
      }
      guardVersion(row, command.version);
    } else if (command.version !== 0 || !["save", "submit"].includes(command.action)) throw new CoinageError("This coinage request is not available.");

    if (command.action === "save" || command.action === "submit") {
      const data = parseFields(command.fields, command.action === "submit");
      const club = await liveSiteById(data.clubId, tx);
      if (!club) throw new CoinageError("Choose an active site.");
      const update = transition(row ?? { status: "DRAFT", creatorId: who.id, totalCents: null }, who, command);
      const changed = { ...data, ...update, clubName: club.name, ...(command.action === "submit" ? { submittedAt: new Date() } : {}) };
      row = row ? await tx.coinageRequest.update({ where: { id: row.id }, data: { ...changed, version: { increment: 1 } } })
        : await tx.coinageRequest.create({ data: { ...changed, id: command.id, creatorId: who.id, creatorName: who.name } });
    } else {
      guardRead(row, who);
      row = await tx.coinageRequest.update({ where: { id: row.id }, data: { ...transition(row, who, command), version: { increment: 1 } } });
    }
    const event = await recordEvent(tx, row, who, command.action, command.operationId, command.note);
    await queueNotifications(tx, row, event.id, command.action);
    return row;
  });
}
