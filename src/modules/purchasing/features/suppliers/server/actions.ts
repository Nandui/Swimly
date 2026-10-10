"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { roleById, withRoles } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { requirePurchasingActor } from "@/modules/purchasing/shared/access";
import { revalidatePurchasing as revalidate, text } from "@/modules/purchasing/shared/forms";
import { centsOf, euro } from "@/modules/purchasing/shared/rules";

/** Purchasing's supplier writes (docs/purchasing.md). Suppliers, products and
 *  approval rules need `purchasing.manage`. Every write is audited. */

async function manager() {
  const who = await requirePurchasingActor();
  if (!who.manage || !who.orgId) return null;
  return who;
}
const NOT_MANAGER = "Managing suppliers needs Purchasing: Manage.";
/* Suppliers. */

const supplierSchema = z.object({
  name: z.string().trim().min(2, "Give the supplier's name.").max(100),
  accountNumber: text(60), contactName: text(100), email: z.string().trim().max(200).refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Use an email address like orders@example.com.").default(""),
  phone: text(40), note: text(500),
});
export type SupplierInput = z.input<typeof supplierSchema>;

export async function saveSupplier(id: string | null, input: SupplierInput): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const parsed = supplierSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const result = await onUniqueViolation(() => prisma.$transaction(async (tx) => {
    if (id) {
      const moved = await tx.supplier.updateMany({ where: { id, orgId: who.orgId! }, data });
      if (moved.count !== 1) return fail("That supplier no longer exists.");
    }
    const saved = id ? { id } : await tx.supplier.create({ data: { ...data, orgId: who.orgId! }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: id ? "update" : "create", entity: "Supplier", entityId: saved.id, clubId: null, summary: `${id ? "Changed" : "Approved"} supplier ${data.name}` }, tx);
    return ok();
  }), `There is already a supplier called ${data.name}.`);
  if (result.ok) revalidate();
  return result;
}

/** Archived suppliers cannot be ordered from; their orders stay. */
export async function setSupplierArchived(id: string, archived: boolean): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const supplier = await prisma.supplier.findFirst({ where: { id, orgId: who.orgId! }, select: { name: true } });
  if (!supplier) return fail("That supplier no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.supplier.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "Supplier", entityId: id, clubId: null, summary: `${archived ? "Removed" : "Restored"} ${supplier.name} ${archived ? "from" : "to"} the approved suppliers` }, tx);
  });
  revalidate();
  return ok();
}

/* Approved products. */

const productSchema = z.object({
  name: z.string().trim().min(2, "Give the product's name.").max(120),
  code: text(60), unit: text(60),
  price: z.string(),
});
export type ProductInput = z.input<typeof productSchema>;

export async function saveProduct(supplierId: string, id: string | null, input: ProductInput): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const priceCents = centsOf(parsed.data.price);
  if (priceCents === null) return fail("Give the agreed price before VAT, like 12.50.");
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, orgId: who.orgId! }, select: { name: true } });
  if (!supplier) return fail("That supplier no longer exists.");
  const data = { name: parsed.data.name, code: parsed.data.code, unit: parsed.data.unit, priceCents };
  await prisma.$transaction(async (tx) => {
    const saved = id
      ? (await tx.purchaseProduct.updateMany({ where: { id, supplierId }, data }), { id })
      : await tx.purchaseProduct.create({ data: { ...data, supplierId }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: id ? "update" : "create", entity: "PurchaseProduct", entityId: saved.id, clubId: null,
      summary: `${id ? "Changed" : "Approved"} ${data.name} from ${supplier.name} at ${euro(priceCents)}${data.unit ? ` per ${data.unit}` : ""}` }, tx);
  });
  revalidatePath(`/purchasing/suppliers/${supplierId}`);
  return ok();
}

export async function setProductArchived(id: string, archived: boolean): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const product = await prisma.purchaseProduct.findFirst({ where: { id, supplier: { orgId: who.orgId! } }, select: { name: true, supplierId: true, supplier: { select: { name: true } } } });
  if (!product) return fail("That product no longer exists.");
  await prisma.$transaction(async (tx) => {
    await tx.purchaseProduct.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    await logAudit({ actorId: who.id, actorName: who.name, action: archived ? "archive" : "restore", entity: "PurchaseProduct", entityId: id, clubId: null, summary: `${archived ? "Removed" : "Restored"} ${product.name} ${archived ? "from" : "to"} ${product.supplier.name}'s approved products` }, tx);
  });
  revalidatePath(`/purchasing/suppliers/${product.supplierId}`);
  return ok();
}

/* Approval rules: a role, up to an amount, for one supplier or every supplier. */

export async function addApprovalRule(input: { supplierId: string | null; roleId: string; limit: string }): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const limitCents = input.limit.trim() === "" ? null : centsOf(input.limit);
  if (input.limit.trim() !== "" && limitCents === null) return fail("Give the limit as an amount like 500, or leave it empty for no limit.");
  const role = await roleById(input.roleId);
  if (!role) return fail("Choose a role.");
  const supplier = input.supplierId ? await prisma.supplier.findFirst({ where: { id: input.supplierId, orgId: who.orgId! }, select: { name: true } }) : null;
  if (input.supplierId && !supplier) return fail("That supplier no longer exists.");
  const clash = await prisma.purchaseApprovalRule.findFirst({ where: { orgId: who.orgId!, supplierId: input.supplierId, roleId: role.id }, select: { id: true } });
  if (clash) return fail(`${role.name} already approves for ${supplier?.name ?? "every supplier"}. Remove that rule first to change its limit.`);
  await prisma.$transaction(async (tx) => {
    const rule = await tx.purchaseApprovalRule.create({ data: { orgId: who.orgId!, supplierId: input.supplierId, roleId: role.id, limitCents }, select: { id: true } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "create", entity: "PurchaseApprovalRule", entityId: rule.id, clubId: null,
      summary: `${role.name} may approve orders ${limitCents === null ? "of any amount" : `up to ${euro(limitCents)}`} from ${supplier?.name ?? "every supplier without its own approvers"}` }, tx);
  });
  revalidate();
  if (input.supplierId) revalidatePath(`/purchasing/suppliers/${input.supplierId}`);
  return ok();
}

export async function removeApprovalRule(id: string): Promise<ActionResult> {
  const who = await manager();
  if (!who) return fail(NOT_MANAGER);
  const rule = await prisma.purchaseApprovalRule.findFirst({ where: { id, orgId: who.orgId! }, select: { supplierId: true, roleId: true, supplier: { select: { name: true } } } }).then((row) => row && withRoles([row], "roleId", "role").then(([r]) => r));
  if (!rule) return ok();
  await prisma.$transaction(async (tx) => {
    await tx.purchaseApprovalRule.delete({ where: { id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "PurchaseApprovalRule", entityId: id, clubId: null, summary: `${rule.role.name} no longer approves orders from ${rule.supplier?.name ?? "every supplier"}` }, tx);
  });
  revalidate();
  if (rule.supplierId) revalidatePath(`/purchasing/suppliers/${rule.supplierId}`);
  return ok();
}
