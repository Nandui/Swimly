import "server-only";
import { notFound } from "next/navigation";
import { liveSitesWithin, withSites } from "@/lib/directory";
import { today } from "@/lib/format";
import { mayFor, sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireStockActor } from "@/modules/stock/shared/access";
import { inSites, iso } from "@/modules/stock/shared/reads";
import { stockTakeState } from "@/modules/stock/shared/rules";

/** The reads for counts. Counts are limited to the sites `stock.read` covers; a
 *  count outside them is a 404. */

const PRODUCT = { id: true, name: true, unitLabel: true, archivedAt: true, category: { select: { id: true, name: true, tone: true, sortOrder: true } } } as const;

/** The counts page: every count at the person's sites, newest first, and where they may start one. */
export async function stockCounts() {
  const who = await requireStockActor();
  const [sites, countSites] = await Promise.all([sitesFor("stock.read"), sitesFor("stock.count")]);
  const [live, takes, canStartAt] = await Promise.all([
    prisma.stockProduct.count({ where: { orgId: who.orgId ?? undefined, archivedAt: null } }),
    prisma.stockTake.findMany({
      where: { orgId: who.orgId ?? undefined, ...inSites(sites) }, orderBy: [{ stockDate: "desc" }, { startedAt: "desc" }], take: 200,
      select: { id: true, siteId: true, stockDate: true, startedAt: true, startedByName: true, submittedAt: true, submittedByName: true, _count: { select: { lines: true } } },
    }),
    who.count ? liveSitesWithin(who.orgId, countSites) : Promise.resolve([]),
  ]);
  const rows = (await withSites(takes, "siteId", "site")).map((t) => ({
    id: t.id, site: t.site.name, siteId: t.siteId, stockDate: iso(t.stockDate), startedAt: t.startedAt, startedByName: t.startedByName,
    submittedAt: t.submittedAt, submittedByName: t.submittedByName, counted: t._count.lines, state: stockTakeState(t.submittedAt),
  }));
  const openAt = new Set(rows.filter((r) => r.state === "open").map((r) => r.siteId));
  return { who, live, takes: rows, startSites: canStartAt.map((s) => ({ ...s, open: openAt.has(s.id) })), today: today() };
}
export type StockCountRow = Awaited<ReturnType<typeof stockCounts>>["takes"][number];

/** One count and its sheet: every live product, plus any archived since that it already counts. */
export async function stockTake(id: string) {
  const who = await requireStockActor();
  const take = await prisma.stockTake.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: { id: true, orgId: true, siteId: true, stockDate: true, startedAt: true, startedByName: true, submittedAt: true, submittedByName: true, notes: true,
      lines: { select: { productId: true, quantity: true, countedAt: true, countedByName: true } } },
  });
  if (!take) notFound();
  const resource = { siteId: take.siteId, orgId: take.orgId };
  if (!(await mayFor("stock.read", resource))) notFound();
  const lineIds = take.lines.map((l) => l.productId);
  const [[withSite], products, canCount, canManage] = await Promise.all([
    withSites([take], "siteId", "site"),
    prisma.stockProduct.findMany({ where: { orgId: take.orgId, OR: [{ archivedAt: null }, { id: { in: lineIds } }] }, select: PRODUCT }),
    mayFor("stock.count", resource),
    mayFor("stock.manage", resource),
  ]);
  const state = stockTakeState(take.submittedAt);
  return {
    take: { ...withSite, stockDate: iso(take.stockDate), state },
    products: products.map((p) => ({ id: p.id, name: p.name, unitLabel: p.unitLabel, archived: !!p.archivedAt, category: p.category })),
    canCount: canCount && state === "open",
    canDelete: canManage,
  };
}
