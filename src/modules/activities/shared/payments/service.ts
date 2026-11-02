import "server-only";
import type { PaymentFailure, Prisma } from "@/generated/prisma/client";
import { logAudit } from "@/lib/audit";
import { PaymentError } from "@/modules/activities/shared/payments/rules";
import { euro, monthLabel, PAYMENT_ACTIONS, type PaymentAction, type PaymentView } from "@/modules/activities/shared/payments/types";
import type { PaymentsActor } from "@/modules/activities/shared/payments/access";

/** What every Payments step shares: the failure's lock, the version check, the replay check, and
 *  the history row with its audit row in the same transaction. */

export async function lockFailure(tx: Prisma.TransactionClient, id: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`payments:${id}`}, 0))`;
}

/** True when this operation already landed (a second press, a retry); refused when the reference
 *  was used for something else. */
export async function alreadyDone(tx: Prisma.TransactionClient, failureId: string, operationId: string, who: PaymentsActor, action: PaymentAction) {
  const event = await tx.paymentFailureEvent.findUnique({ where: { failureId_operationId: { failureId, operationId } }, select: { actorId: true, action: true } });
  if (!event) return false;
  if (event.actorId !== who.id || event.action !== action) throw new PaymentError("This step was already recorded. Refresh the page.");
  return true;
}

export function guardVersion(row: { version: number }, version: number) {
  if (row.version !== version) throw new PaymentError("Someone else updated this payment while you were looking at it. Refresh the page to see the latest, then try again.");
}

/** "Synthetic Parent, €54.00 failed in September 2026": how a failure reads in the activity log. */
export const failureLabel = (row: Pick<PaymentFailure, "name" | "amountCents" | "month">) => `${row.name}, ${euro(row.amountCents)} failed in ${monthLabel(row.month)}`;

/** One step: its history row and its audit row, beside the write that made it. */
export async function recordStep(tx: Prisma.TransactionClient, row: Pick<PaymentFailure, "id" | "orgId" | "siteId" | "name" | "amountCents" | "month">, who: PaymentsActor, action: PaymentAction, operationId: string, extra: { method?: string; result?: string; note?: string; words?: string } = {}) {
  const note = extra.note ?? "";
  await tx.paymentFailureEvent.create({ data: { orgId: row.orgId, failureId: row.id, operationId, actorId: who.id, actorName: who.name, action, method: extra.method ?? "", result: extra.result ?? "", note } });
  await logAudit({
    actorId: who.id, actorName: who.name, entity: "PaymentFailure", entityId: row.id, clubId: row.siteId, action,
    summary: `${failureLabel(row)}. ${PAYMENT_ACTIONS[action]}${extra.words ? ` (${extra.words})` : ""}${note ? `: ${note}` : ""}`.slice(0, 1000),
  }, tx);
}

/** A failure for screens, through an allowlist: no Core rows beyond the site's name. */
export function paymentView(row: PaymentFailure, siteName: string): PaymentView {
  return {
    id: row.id, status: row.status as PaymentView["status"], version: row.version,
    siteId: row.siteId, siteName, month: row.month, reference: row.reference, memberNumber: row.memberNumber, memberId: row.memberId,
    name: row.name, amountCents: row.amountCents, returnCode: row.returnCode, returnReason: row.returnReason,
    attempts: row.attempts, lastContactAt: row.lastContactAt?.toISOString() ?? null, outcome: row.outcome,
    closedByName: row.closedByName, closedAt: row.closedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(),
  };
}
