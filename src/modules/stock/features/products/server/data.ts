import "server-only";
import { prisma } from "@/lib/prisma";
import { requireStockActor } from "@/modules/stock/shared/access";

/** The product list and its categories (docs/stock.md): one list for the organisation. Anyone with
 *  Stock reads it; Manage keeps it. */

export async function stockProducts() {
  const who = await requireStockActor();
  const orgId = who.orgId ?? undefined;
  const [products, categories] = await Promise.all([
    prisma.stockProduct.findMany({
      where: { orgId }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
      select: { id: true, name: true, sku: true, unitLabel: true, caseSize: true, barcode: true, notes: true, archivedAt: true, categoryId: true, category: { select: { id: true, name: true, tone: true, sortOrder: true } } },
    }),
    prisma.stockCategory.findMany({ where: { orgId, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
  ]);
  return { who, products, categories };
}
export type StockProductRow = Awaited<ReturnType<typeof stockProducts>>["products"][number];

export async function stockCategories() {
  const who = await requireStockActor();
  const categories = await prisma.stockCategory.findMany({
    where: { orgId: who.orgId ?? undefined }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, tone: true, sortOrder: true, archivedAt: true, _count: { select: { products: { where: { archivedAt: null } } } } },
  });
  return { who, categories };
}
