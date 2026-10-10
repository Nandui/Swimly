import { prisma } from "@/lib/prisma";
import { liveSites, staffSiteIds } from "@/lib/directory";
import { requireRefundActor } from "@/modules/refunds/shared/auth";
import { refundView } from "@/modules/refunds/shared/data";
import { guardRead, receiptSelect } from "@/modules/refunds/shared/service";
import type { RefundDetail } from "@/modules/refunds/shared/types";

export async function refundSites() {
  await requireRefundActor();
  return liveSites();
}
/** The site a new request starts at: the person's one work site when they have exactly one
 *  (none listed means every site, so no default), else the only site there is. */
export async function refundDefaultSite(sites: { id: string }[]) {
  const who = await requireRefundActor();
  if (sites.length === 1) return sites[0].id;
  const workSites = await staffSiteIds(who.id);
  const mine = sites.filter(site => workSites.includes(site.id));
  return mine.length === 1 ? mine[0].id : "";
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
