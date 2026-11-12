"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { BISHOPSTOWN_SHEET } from "@/modules/stock/features/products/server/sheet";
import { STOCK_CATEGORY_TONES } from "@/modules/stock/shared/rules";
import { refresh } from "@/modules/stock/shared/server";

/** Writes for the product list and its categories: Manage keeps them. Products and
 *  categories are archived, never deleted, so every old count stays readable. Every write is audited. */

const optional = (max: number, message: string) => z.string().trim().max(max, message).default("").transform((v) => v || null);

const productSchema = z.object({
  name: z.string().trim().min(2, "Give the product a name of at least 2 characters.").max(120, "Keep the name under 120 characters."),
  categoryId: z.string().min(1, "Choose a category."),
  unitLabel: z.string().trim().min(1, "Say what one of these is: a can, a bottle, each.").max(30, "Keep the unit short."),
  sku: optional(40, "A SKU should be short.").transform((v) => v?.toUpperCase() ?? null),
  caseSize: z.union([z.literal(""), z.coerce.number().int().min(1, "A case holds at least one.").max(10_000)]).default(""),
  barcode: optional(40, "That barcode is too long."),
  notes: z.string().trim().max(500, "Keep notes under 500 characters.").default(""),
});
export type ProductInput = z.input<typeof productSchema>;

/** Add a product to the list, or change one. */
export async function saveProduct(id: string | null, input: ProductInput): Promise<ActionResult> {
  const session = await requirePermission("stock.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  const before = id ? await prisma.stockProduct.findFirst({ where: { id, orgId }, select: { name: true, categoryId: true, unitLabel: true, category: { select: { name: true } } } }) : null;
  if (id && !before) return fail("That product no longer exists.");
  const category = await prisma.stockCategory.findFirst({ where: { id: d.categoryId, orgId }, select: { name: true, archivedAt: true } });
  if (!category) return fail("That category no longer exists.");
  if (category.archivedAt && before?.categoryId !== d.categoryId) return fail(`${category.name} is archived. Choose another category, or restore it.`);
  if (await prisma.stockProduct.findFirst({ where: { orgId, name: { equals: d.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) {
    return fail(`There is already a product called ${d.name}.`);
  }
  const data = { name: d.name, categoryId: d.categoryId, unitLabel: d.unitLabel, sku: d.sku, caseSize: d.caseSize === "" ? null : d.caseSize, barcode: d.barcode, notes: d.notes };
  const changes = before ? [
    before.name !== d.name ? `name ${before.name} to ${d.name}` : null,
    before.categoryId !== d.categoryId ? `category ${before.category.name} to ${category.name}` : null,
    before.unitLabel !== d.unitLabel ? `unit ${before.unitLabel} to ${d.unitLabel}` : null,
  ].filter(Boolean) : [];
  await prisma.$transaction(async (tx) => {
    const row = id ? await tx.stockProduct.update({ where: { id }, data }) : await tx.stockProduct.create({ data: { ...data, orgId } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "StockProduct", entityId: row.id, clubId: null,
      summary: id ? `Changed the stock product ${d.name}${changes.length ? ` (${changes.join(", ")})` : ""}` : `Added the stock product ${d.name}, counted in ${d.unitLabel}` }, tx);
  });
  refresh();
  return ok();
}

/** Archive a product (it stays on old counts but is not offered on new ones), or bring it back. */
export async function archiveProduct(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("stock.manage");
  const product = await prisma.stockProduct.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true } });
  if (!product) return fail("That product no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.stockProduct.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "StockProduct", entityId: id, clubId: null,
      summary: archived ? `Archived the stock product ${product.name}` : `Brought the stock product ${product.name} back into use` }, tx);
  });
  refresh();
  return ok();
}

const categorySchema = z.object({
  name: z.string().trim().min(2, "Give the category a name of at least 2 characters.").max(40, "Keep the name under 40 characters."),
  tone: z.enum(STOCK_CATEGORY_TONES),
});
export type CategoryInput = z.input<typeof categorySchema>;

/** Add a category, or rename or recolour one. New ones go to the end of the list. */
export async function saveCategory(id: string | null, input: CategoryInput): Promise<ActionResult> {
  const session = await requirePermission("stock.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const d = parsed.data;
  if (id && !(await prisma.stockCategory.findFirst({ where: { id, orgId }, select: { id: true } }))) return fail("That category no longer exists.");
  if (await prisma.stockCategory.findFirst({ where: { orgId, name: { equals: d.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) {
    return fail(`There is already a category called ${d.name}.`);
  }
  await prisma.$transaction(async (tx) => {
    const last = id ? null : await tx.stockCategory.findFirst({ where: { orgId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    const row = id ? await tx.stockCategory.update({ where: { id }, data: d }) : await tx.stockCategory.create({ data: { ...d, orgId, sortOrder: (last?.sortOrder ?? -1) + 1 } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: id ? "update" : "create", entity: "StockCategory", entityId: row.id, clubId: null,
      summary: `${id ? "Changed" : "Added"} the stock category ${d.name}` }, tx);
  });
  refresh();
  return ok();
}

/** Archive a category, or bring it back. Only an empty one can be archived: move its products first. */
export async function archiveCategory(id: string, archived: boolean): Promise<ActionResult> {
  const session = await requirePermission("stock.manage");
  const category = await prisma.stockCategory.findFirst({ where: { id, orgId: session.user.orgId ?? undefined }, select: { name: true, _count: { select: { products: { where: { archivedAt: null } } } } } });
  if (!category) return fail("That category no longer exists.");
  if (archived && category._count.products > 0) return fail(`${category.name} still has products in use. Move them to another category first.`);
  await prisma.$transaction(async (tx) => {
    await tx.stockCategory.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: archived ? "archive" : "update", entity: "StockCategory", entityId: id, clubId: null,
      summary: `${archived ? "Archived" : "Restored"} the stock category ${category.name}` }, tx);
  });
  refresh();
  return ok();
}

/** Add the Bishopstown stock sheet's product names that are not on the list yet, under Other,
 *  counted "each". Names only: units, SKUs and categories are filled in afterwards. */
export async function addSheetProducts(): Promise<ActionResult> {
  const session = await requirePermission("stock.manage");
  const orgId = session.user.orgId;
  if (!orgId) return fail("Your account is not in an organisation.");
  const other = await prisma.stockCategory.findFirst({ where: { orgId, name: "Other", archivedAt: null }, select: { id: true } });
  if (!other) return fail("The Other category is missing or archived. Add or restore it under Categories first.");
  const have = new Set((await prisma.stockProduct.findMany({ where: { orgId }, select: { name: true } })).map((p) => p.name.toLowerCase()));
  const missing = BISHOPSTOWN_SHEET.filter((name) => !have.has(name.toLowerCase()));
  if (missing.length === 0) return fail("Every product on the sheet is already on the list.");
  await prisma.$transaction(async (tx) => {
    for (const name of missing) {
      const row = await tx.stockProduct.create({ data: { orgId, name, categoryId: other.id } });
      await logAudit({ actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: "create", entity: "StockProduct", entityId: row.id, clubId: null,
        summary: `Added the stock product ${name} from the Bishopstown stock sheet` }, tx);
    }
  }, { timeout: 30_000 });
  refresh();
  return ok();
}
