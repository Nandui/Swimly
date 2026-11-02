import "server-only";
import type { DeskMeasure, DeskMeasureQuery } from "@/modules/contributions";
import { prisma } from "@/lib/prisma";

/** Refund requests raised at the desk, for the swim school's reception analytics (`registerDeskMeasures`):
 *  how long each one sat as a draft before whoever raised it sent it for review. Still waiting is a draft
 *  nobody has sent. Refunds makes no promise about this, so none is on time or late. */
export async function refundsSent(query: DeskMeasureQuery): Promise<DeskMeasure[]> {
  if (query.siteIds?.length === 0) return [];
  const from = new Date(`${query.from}T00:00:00Z`), to = new Date(`${query.to}T23:59:59Z`);
  const rows = await prisma.refundRequest.findMany({
    where: {
      ...(query.siteIds ? { clubId: { in: [...query.siteIds] } } : {}),
      OR: [{ submittedAt: { gte: from, lte: to } }, { status: "DRAFT" }],
    },
    select: { clubId: true, creatorId: true, creatorName: true, status: true, createdAt: true, submittedAt: true },
  });
  const minutes = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / 60_000));
  return rows.map((row): DeskMeasure => {
    const base = { kind: "refunds.sent", label: "Refund requests sent", module: "Refunds", siteId: row.clubId, onTime: null };
    return row.submittedAt
      ? { ...base, userId: row.creatorId, userName: row.creatorName, at: row.submittedAt.toISOString(), minutes: minutes(row.createdAt, row.submittedAt), open: false }
      : { ...base, userId: row.creatorId, userName: row.creatorName, at: row.createdAt.toISOString(), minutes: minutes(row.createdAt, query.now), open: true };
  });
}
