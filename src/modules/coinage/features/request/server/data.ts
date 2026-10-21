import { prisma } from "@/lib/prisma";
import { liveSites, staffSiteIds } from "@/lib/directory";
import { requireCoinageActor } from "@/modules/coinage/shared/auth";
import { coinageView } from "@/modules/coinage/shared/data";
import { guardRead } from "@/modules/coinage/shared/service";
import type { CoinageDetail } from "@/modules/coinage/shared/types";

export async function coinageSites() {
  await requireCoinageActor();
  return liveSites();
}
/** The site a new request starts at: the person's one work site when they have exactly one
 *  (none listed means every site, so no default), else the only site there is. */
export async function coinageDefaultSite(sites: { id: string }[]) {
  const who = await requireCoinageActor();
  if (sites.length === 1) return sites[0].id;
  const workSites = await staffSiteIds(who.id);
  const mine = sites.filter(site => workSites.includes(site.id));
  return mine.length === 1 ? mine[0].id : "";
}
export async function getCoinage(id: string): Promise<CoinageDetail> {
  const who = await requireCoinageActor();
  const row = await prisma.coinageRequest.findUnique({ where: { id } });
  guardRead(row, who);
  const [events, delivery] = await Promise.all([
    prisma.coinageEvent.findMany({ where: { requestId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.coinageNotification.findMany({ where: { requestId: id, status: { in: ["PENDING", "FAILED", "SENDING"] } }, select: { id: true, status: true, error: true } }),
  ]);
  return { request: coinageView(row), events: events.map(event => ({ ...event, snapshot: event.snapshot as Record<string, unknown>, createdAt: event.createdAt.toISOString() })), delivery };
}
