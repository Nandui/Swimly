import type { Prisma, RefundRequest } from "@/generated/prisma/client";
import type { RefundActor, RefundView } from "@/modules/refunds/shared/types";

export const refundVisibility = (who: RefundActor): Prisma.RefundRequestWhereInput => ({ OR: [{ creatorId: who.id }, { submittedAt: { not: null }, status: { not: "DRAFT" } }] });
export function refundView(row: RefundRequest): RefundView {
  return { ...row, status: row.status as RefundView["status"], service: row.service as RefundView["service"], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), submittedAt: row.submittedAt?.toISOString() ?? null };
}
