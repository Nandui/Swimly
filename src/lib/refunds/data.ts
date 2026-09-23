import type { Prisma, RefundRequest } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRefundActor } from "@/lib/refunds/auth";
import { guardRead, receiptSelect } from "@/lib/refunds/service";
import { refundStatuses, refundServices, type RefundActor, type RefundDetail, type RefundView } from "@/lib/refunds/types";

export const refundVisibility = (who: RefundActor): Prisma.RefundRequestWhereInput => ({ OR: [{ creatorId: who.id }, { submittedAt: { not: null }, status: { not: "DRAFT" } }] });
export function refundView(row: RefundRequest): RefundView {
  return { ...row, status: row.status as RefundView["status"], service: row.service as RefundView["service"], createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), submittedAt: row.submittedAt?.toISOString() ?? null };
}
export async function refundSites() {
  await requireRefundActor();
  return prisma.club.findMany({ where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } });
}
export type RefundFilters = { q?: string; site?: string; status?: string; service?: string; creator?: string; handler?: string; page?: string };
export async function listRefunds(filters: RefundFilters) {
  const who = await requireRefundActor();
  const status = filters.status || (who.review || who.process ? "actionable" : "open");
  const and: Prisma.RefundRequestWhereInput[] = [refundVisibility(who)];
  if (filters.site) and.push({ clubId: filters.site });
  if (filters.service && Object.hasOwn(refundServices, filters.service)) and.push({ service: filters.service });
  if (filters.creator) and.push({ creatorId: filters.creator });
  if (filters.handler) and.push(filters.handler === "unassigned" ? { handlerId: null } : { handlerId: filters.handler });
  if (filters.q?.trim()) {
    const q = filters.q.trim().slice(0, 200), numeric = /^RF-\d+$/i.test(q) ? Number(q.slice(3)) : null;
    and.push({ OR: [{ customerName: { contains: q, mode: "insensitive" } }, { memberNumber: { contains: q, mode: "insensitive" } }, { paymentReference: { contains: q, mode: "insensitive" } }, ...(numeric && numeric < 2147483647 ? [{ number: numeric }] : [])] });
  }
  const scope = { AND: [...and] };
  if (Object.hasOwn(refundStatuses, status)) and.push({ status });
  else if (status === "actionable") and.push({ status: { in: [...(who.review ? ["SUBMITTED", "IN_REVIEW"] : []), ...(who.process ? ["APPROVED"] : []), ...(who.request ? ["NEEDS_INFORMATION"] : [])] } });
  else if (status === "open") and.push({ status: { notIn: ["REFUNDED", "DECLINED", "WITHDRAWN"] } });
  const where = { AND: and };
  const [total, counts, people, sites] = await Promise.all([
    prisma.refundRequest.count({ where }),
    prisma.refundRequest.groupBy({ by: ["status"], where: scope, _count: { _all: true } }),
    prisma.refundRequest.findMany({ where: refundVisibility(who), distinct: ["creatorId", "handlerId"], select: { creatorId: true, creatorName: true, handlerId: true, handlerName: true } }),
    prisma.club.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 25)), page = Math.min(pages, Math.max(1, Number.parseInt(filters.page || "1", 10) || 1));
  const rows = await prisma.refundRequest.findMany({ where, orderBy: [{ submittedAt: status === "actionable" ? "asc" : "desc" }, { createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * 25, take: 25 });
  return { who, rows: rows.map(refundView), total, counts: Object.fromEntries(counts.map(item => [item.status, item._count._all])), people, sites, page, pages, filters: { ...filters, status } };
}
export async function getRefund(id: string): Promise<RefundDetail> {
  const who = await requireRefundActor();
  const row = await prisma.refundRequest.findUnique({ where: { id } });
  guardRead(row, who);
  const [attachments, events, delivery] = await Promise.all([
    prisma.refundAttachment.findMany({ where: { requestId: id }, select: receiptSelect, orderBy: { createdAt: "asc" } }),
    prisma.refundEvent.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.refundNotification.findMany({ where: { requestId: id, status: { in: ["PENDING", "FAILED", "SENDING"] } }, select: { id: true, status: true, error: true } }),
  ]);
  return { request: refundView(row), attachments: attachments.map(file => ({ ...file, removedAt: file.removedAt?.toISOString() ?? null })), events: events.map(event => ({ ...event, snapshot: event.snapshot as Record<string, unknown>, createdAt: event.createdAt.toISOString() })), delivery };
}
