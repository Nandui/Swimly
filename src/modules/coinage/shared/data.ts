import type { CoinageRequest, Prisma } from "@/generated/prisma/client";
import type { CoinageActor, CoinageLines, CoinageView } from "@/modules/coinage/shared/types";

/** Everyone with Coinage sees sent requests; a draft only its creator. */
export const coinageVisibility = (who: CoinageActor): Prisma.CoinageRequestWhereInput => ({ OR: [{ creatorId: who.id }, { submittedAt: { not: null }, status: { not: "DRAFT" } }] });
export function coinageView(row: CoinageRequest): CoinageView {
  return {
    id: row.id, number: row.number, status: row.status as CoinageView["status"], version: row.version, creatorId: row.creatorId, creatorName: row.creatorName,
    clubId: row.clubId, clubName: row.clubName, forWhom: row.forWhom, neededBy: row.neededBy, lines: (row.lines ?? {}) as CoinageLines, totalCents: row.totalCents, notes: row.notes,
    handlerId: row.handlerId, handlerName: row.handlerName, approvedByName: row.approvedByName,
    orderedOn: row.orderedOn, deliveryOn: row.deliveryOn, orderReference: row.orderReference, orderedByName: row.orderedByName,
    submittedAt: row.submittedAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
