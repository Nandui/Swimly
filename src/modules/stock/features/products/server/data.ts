import "server-only";
import { prisma } from "@/lib/prisma";
import { BISHOPSTOWN_SHEET } from "@/modules/stock/features/products/server/sheet";
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
  const names = new Set(products.map((p) => p.name.toLowerCase()));
  // Offered once: until any of the sheet's names is on the list.
  const sheetMissing = BISHOPSTOWN_SHEET.some((name) => names.has(name.toLowerCase())) ? 0 : BISHOPSTOWN_SHEET.length;
  return { who, products, categories, sheetMissing };
}

export async function stockCategories() {
  const who = await requireStockActor();
  const categories = await prisma.stockCategory.findMany({
    where: { orgId: who.orgId ?? undefined }, orderBy: [{ archivedAt: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, tone: true, sortOrder: true, archivedAt: true, _count: { select: { products: { where: { archivedAt: null } } } } },
  });
  return { who, categories };
}
