"use server";

import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { staffRoleIdOf, withSiteStatus } from "@/lib/directory";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor, sitesFor } from "@/lib/policy/session";
import { requirePurchasingActor } from "@/modules/purchasing/shared/access";
import { revalidatePurchasing as revalidate, text } from "@/modules/purchasing/shared/forms";
import { EDITABLE, approverRoles, euro, mayApprove, orderTotal, poNumber, type PoStatus } from "@/modules/purchasing/shared/rules";

/** Purchasing's order writes (docs/purchasing.md). Raising an order needs
 *  `purchasing.request` at its site; approving needs a role the rules name for
 *  that supplier and amount, and never your own order. Every write is audited. */

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
    select: { status: true, siteId: true, supplierId: true, totalCents: true, requestedById: true, supplier: { select: { name: true } } },
  }).then(async (row) => row && (await withSiteStatus([row], "siteId", "site"))[0]);
  if (!order) return fail("That order no longer exists.");
  if (order.status !== "pending") return fail("That order is not waiting for approval any more.");
  if (order.requestedById === who.id) return fail("Someone else has to approve your own order.");
  const sites = await sitesFor("purchasing.read");
  if (sites.kind !== "all" && !sites.siteIds.has(order.siteId)) return fail("That order is for a site your role does not cover.");
  if (!who.superadmin) {
    const [rules, roleId] = await Promise.all([
      prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined }, select: { supplierId: true, roleId: true, limitCents: true } }),
      staffRoleIdOf(who.id),
    ]);
    if (!mayApprove(rules, order.supplierId, roleId, order.totalCents)) return fail(`Your role may not approve ${euro(order.totalCents)} from ${order.supplier.name}.`);
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
