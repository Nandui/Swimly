import "server-only";
import { withSites } from "@/lib/directory";
import { sitesFor } from "@/lib/policy/session";
import { prisma } from "@/lib/prisma";
import { requireStockActor } from "@/modules/stock/shared/access";
import { inSites, iso } from "@/modules/stock/shared/reads";
import { compareCounts, compareTotals } from "@/modules/stock/shared/rules";

/** Two submitted counts at one site, side by side (docs/stock.md). Without a choice it compares
 *  the latest two at the first site that has two. */
export async function stockComparison(choice: { from?: string; to?: string }) {
  const who = await requireStockActor();
  const takes = await withSites(await prisma.stockTake.findMany({
    where: { orgId: who.orgId ?? undefined, submittedAt: { not: null }, ...inSites(await sitesFor("stock.read")) },
    orderBy: [{ stockDate: "desc" }, { submittedAt: "desc" }], take: 300,
    select: { id: true, siteId: true, stockDate: true, _count: { select: { lines: true } } },
  }), "siteId", "site");
  const options = takes.map((t) => ({ id: t.id, siteId: t.siteId, site: t.site.name, stockDate: iso(t.stockDate), counted: t._count.lines }));
  const byId = new Map(options.map((o) => [o.id, o]));
  let to = choice.to ? byId.get(choice.to) : undefined;
  let from = choice.from ? byId.get(choice.from) : undefined;
  if (!to && !from) {
    const site = options.find((o) => options.filter((p) => p.siteId === o.siteId).length >= 2)?.siteId;
    [to, from] = options.filter((o) => o.siteId === site);
  }
  if (!from || !to) return { options, from, to, problem: null, rows: [], totals: null };
  if (from.siteId !== to.siteId) return { options, from, to, problem: "Choose two counts at the same site.", rows: [], totals: null };
  if (from.id === to.id) return { options, from, to, problem: "Choose two different counts.", rows: [], totals: null };
  if (options.indexOf(from) < options.indexOf(to)) [from, to] = [to, from];
  const lines = await prisma.stockTakeLine.findMany({
    where: { stockTakeId: { in: [from.id, to.id] } },
    select: { stockTakeId: true, quantity: true, product: { select: { id: true, name: true, unitLabel: true, category: { select: { id: true, name: true, tone: true, sortOrder: true } } } } },
  });
  const products = new Map(lines.map((l) => [l.product.id, l.product]));
  const qty = (takeId: string) => new Map(lines.filter((l) => l.stockTakeId === takeId).map((l) => [l.product.id, l.quantity]));
  const rows = compareCounts([...products.values()], qty(from.id), qty(to.id));
  return { options, from, to, problem: null, rows, totals: compareTotals(rows) };
}
export type StockComparison = Awaited<ReturnType<typeof stockComparison>>;
