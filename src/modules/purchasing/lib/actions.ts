"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, onUniqueViolation, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor, sitesFor } from "@/lib/policy/session";
import { requirePurchasingActor } from "@/modules/purchasing/lib/access";
import { EDITABLE, approverRoles, centsOf, euro, mayApprove, orderTotal, poNumber, type PoStatus } from "@/modules/purchasing/lib/rules";

/** Purchasing's writes (docs/purchasing.md). Suppliers, products and approval
 *  rules need `purchasing.manage`; raising an order needs `purchasing.request`
 *  at its site; approving needs a role the rules name for that supplier and
 *  amount, and never your own order. Every write is audited. */

function revalidate(id?: string) {
  revalidatePath("/purchasing");
  revalidatePath("/purchasing/suppliers");
  if (id) revalidatePath(`/purchasing/${id}`);
}
async function manager() {
  const who = await requirePurchasingActor();
  if (!who.manage || !who.orgId) return null;
  return who;
}
const NOT_MANAGER = "Managing suppliers needs Purchasing: Manage.";
const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters.`).default("");

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
  const role = await prisma.staffRole.findFirst({ where: { id: input.roleId }, select: { id: true, name: true } });
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
  const rule = await prisma.purchaseApprovalRule.findFirst({ where: { id, orgId: who.orgId! }, select: { supplierId: true, role: { select: { name: true } }, supplier: { select: { name: true } } } });
  if (!rule) return ok();
  await prisma.$transaction(async (tx) => {
    await tx.purchaseApprovalRule.delete({ where: { id } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "PurchaseApprovalRule", entityId: id, clubId: null, summary: `${rule.role.name} no longer approves orders from ${rule.supplier?.name ?? "every supplier"}` }, tx);
  });
  revalidate();
  if (rule.supplierId) revalidatePath(`/purchasing/suppliers/${rule.supplierId}`);
  return ok();
}

/* Orders. */

const orderSchema = z.object({
  siteId: z.string().min(1, "Choose the site it is for."),
  supplierId: z.string().min(1, "Choose a supplier."),
  neededBy: z.string().trim().refine((v) => v === "" || isDateOnly(v), "Use a date for when it is needed, or leave it empty.").transform((v) => v || null),
  note: text(1000),
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1).max(100000) })).max(100, "Up to 100 lines on one order."),
});
export type OrderInput = z.input<typeof orderSchema>;

/** Save an order as a draft, or send it for approval (`submit`). Only approved
 *  products from that supplier, at today's agreed prices. Sending it needs at
 *  least one role allowed to approve that much. */
export async function saveOrder(id: string | null, input: OrderInput, submit: boolean): Promise<ActionResult & { id?: string }> {
  const who = await requirePurchasingActor();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const lines = data.lines.filter((l) => l.quantity > 0);
  if (submit && lines.length === 0) return fail("Add at least one product to send it for approval.");
  try { await requireCapFor("purchasing.request", { siteId: data.siteId, orgId: who.orgId }); }
  catch (error) { if (error instanceof AuthorizationError) return fail("You can only raise orders for the sites your role covers."); throw error; }
  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, orgId: who.orgId ?? undefined, archivedAt: null },
    select: { name: true, products: { where: { archivedAt: null, id: { in: lines.map((l) => l.productId) } }, select: { id: true, name: true, code: true, unit: true, priceCents: true } } },
  });
  if (!supplier) return fail("That supplier is not approved to order from.");
  if (supplier.products.length !== new Set(lines.map((l) => l.productId)).size) return fail("Some of those products are no longer approved. Check the order again.");
  const rows = lines.map((l) => {
    const p = supplier.products.find((x) => x.id === l.productId)!;
    return { productId: p.id, name: p.name, code: p.code, unit: p.unit, unitPriceCents: p.priceCents, quantity: l.quantity };
  });
  const totalCents = orderTotal(rows);
  if (submit) {
    const rules = await prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined }, select: { supplierId: true, roleId: true, limitCents: true } });
    if (approverRoles(rules, data.supplierId, totalCents).length === 0) return fail(`Nobody may approve ${euro(totalCents)} from ${supplier.name} yet. Ask whoever manages suppliers to add an approver for that amount.`);
  }
  const values = { siteId: data.siteId, supplierId: data.supplierId, neededBy: data.neededBy ? parseDateOnly(data.neededBy) : null, note: data.note, totalCents,
    ...(submit ? { status: "pending", submittedAt: new Date(), decidedAt: null, decidedById: null, decidedByName: null, decisionNote: "" } : {}) };
  const result = await prisma.$transaction(async (tx) => {
    let orderId = id;
    if (id) {
      const existing = await tx.purchaseOrder.findFirst({ where: { id, requestedById: who.id, status: { in: [...EDITABLE] } }, select: { id: true } });
      if (!existing) return fail("That order can no longer be changed.");
      await tx.purchaseOrderLine.deleteMany({ where: { orderId: id } });
      await tx.purchaseOrder.update({ where: { id }, data: { ...values, lines: { create: rows } } });
    } else {
      const created = await tx.purchaseOrder.create({ data: { ...values, orgId: who.orgId!, requestedById: who.id, requestedByName: who.name, lines: { create: rows } }, select: { id: true } });
      orderId = created.id;
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: id ? "update" : "create", entity: "PurchaseOrder", entityId: orderId, clubId: data.siteId,
      summary: `${submit ? "Sent for approval" : id ? "Changed" : "Drafted"} an order from ${supplier.name}: ${rows.length} ${rows.length === 1 ? "line" : "lines"}, ${euro(totalCents)}` }, tx);
    return { ...ok(), id: orderId! };
  });
  if (result.ok) revalidate(result.id);
  return result;
}

/** Approve (giving it the site's next number) or reject (with the reason) an
 *  order waiting for approval. Needs a role the rules name for that supplier
 *  and amount, the order's site in reach, and never your own order. */
export async function decideOrder(id: string, decision: "approve" | "reject", note: string): Promise<ActionResult> {
  const who = await requirePurchasingActor();
  const reason = note.trim().slice(0, 1000);
  if (decision === "reject" && reason.length < 3) return fail("Say why it is rejected, so the requester can change it.");
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: { status: true, siteId: true, supplierId: true, totalCents: true, requestedById: true, site: { select: { name: true, code: true } }, supplier: { select: { name: true } } },
  });
  if (!order) return fail("That order no longer exists.");
  if (order.status !== "pending") return fail("That order is not waiting for approval any more.");
  if (order.requestedById === who.id) return fail("Someone else has to approve your own order.");
  const sites = await sitesFor("purchasing.read");
  if (sites.kind !== "all" && !sites.siteIds.has(order.siteId)) return fail("That order is for a site your role does not cover.");
  if (!who.superadmin) {
    const [rules, me] = await Promise.all([
      prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined }, select: { supplierId: true, roleId: true, limitCents: true } }),
      prisma.user.findUnique({ where: { id: who.id }, select: { staffRoleId: true } }),
    ]);
    if (!mayApprove(rules, order.supplierId, me?.staffRoleId ?? null, order.totalCents)) return fail(`Your role may not approve ${euro(order.totalCents)} from ${order.supplier.name}.`);
  }
  if (decision === "approve" && !order.site.code) return fail(`${order.site.name} has no short code yet, so the order cannot be numbered. Give it one in Admin, Clubs (for example BT).`);
  const result = await prisma.$transaction(async (tx) => {
    // Claim the order first, so two approvers at once cannot both number it.
    const claimed = await tx.purchaseOrder.updateMany({ where: { id, status: "pending" }, data: { status: decision === "approve" ? "approved" : "rejected", decidedById: who.id, decidedByName: who.name, decidedAt: new Date(), decisionNote: reason } });
    if (claimed.count !== 1) return fail("Someone decided this order just now.");
    let number: string | null = null;
    if (decision === "approve") {
      // The site's counter row is locked by the update until this commits: numbers never repeat or skip.
      const counter = await tx.purchaseOrderCounter.upsert({ where: { siteId: order.siteId }, create: { siteId: order.siteId, last: 1 }, update: { last: { increment: 1 } }, select: { last: true } });
      number = poNumber(order.site.code!, counter.last);
      await tx.purchaseOrder.update({ where: { id }, data: { number } });
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: decision === "approve" ? "approve" : "reject", entity: "PurchaseOrder", entityId: id, clubId: order.siteId,
      summary: decision === "approve" ? `Approved ${number}: ${order.supplier.name}, ${euro(order.totalCents)}` : `Rejected an order from ${order.supplier.name}, ${euro(order.totalCents)}: ${reason}` }, tx);
    return ok();
  });
  if (result.ok) revalidate(id);
  return result;
}

/** Withdraw an order before it is approved: its requester, or whoever manages suppliers. */
export async function cancelOrder(id: string): Promise<ActionResult> {
  const who = await requirePurchasingActor();
  const order = await prisma.purchaseOrder.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { status: true, siteId: true, requestedById: true, totalCents: true, supplier: { select: { name: true } } } });
  if (!order) return fail("That order no longer exists.");
  if (order.requestedById !== who.id && !who.manage) return fail("Only the person who raised it can cancel it.");
  if (!(["draft", "pending", "rejected"] as PoStatus[]).includes(order.status as PoStatus)) return fail("An approved order cannot be cancelled here; tell the supplier.");
  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({ where: { id }, data: { status: "cancelled", cancelledAt: new Date() } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "cancel", entity: "PurchaseOrder", entityId: id, clubId: order.siteId, summary: `Cancelled an order from ${order.supplier.name}, ${euro(order.totalCents)}` }, tx);
  });
  revalidate(id);
  return ok();
}
