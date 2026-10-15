"use server";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { staffRoleIdOf, withSiteStatus } from "@/lib/directory";
import { sendGoogleEmail } from "@/lib/email/google";
import { emailLogo } from "@/lib/email/logo";
import { emailSender } from "@/lib/email/sender";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { requireCapFor, sitesFor } from "@/lib/policy/session";
import { requirePurchasingActor } from "@/modules/purchasing/shared/access";
import { revalidatePurchasing as revalidate, text } from "@/modules/purchasing/shared/forms";
import { orderEmail, PO_EMAIL_LOGO_CID } from "@/modules/purchasing/features/orders/server/order-email";
import { orderEmailContext } from "@/modules/purchasing/features/orders/server/supplier-email";
import { EDITABLE, MONTHS, approverRoles, euro, mayApprove, orderTotal, poNumber, variantProblem, type PoStatus } from "@/modules/purchasing/shared/rules";

/** Purchasing's order writes (docs/purchasing.md). Raising an order needs
 *  `purchasing.request` at its site; approving needs a role the rules name for
 *  that supplier and amount, and never your own order unless you are an administrator.
 *  Every write is audited. */

/* Orders. */

const orderSchema = z.object({
  siteId: z.string().min(1, "Choose the site it is for."),
  supplierId: z.string().min(1, "Choose a supplier."),
  neededBy: z.string().trim().refine((v) => v === "" || isDateOnly(v), "Use a date for when it is needed, or leave it empty.").transform((v) => v || null),
  note: text(1000),
  lines: z.array(z.object({ productId: z.string().min(1), size: text(30), colour: text(30), quantity: z.coerce.number().int().min(1).max(100000) })).max(100, "Up to 100 lines on one order."),
});
export type OrderInput = z.input<typeof orderSchema>;

/** Save an order as a draft, or send it for approval (`submit`). Only approved
 *  products from that supplier, at today's agreed prices, each in one of the sizes
 *  and colours it comes in (one line for each). Sending it needs at
 *  least one role allowed to approve that much. */
export async function saveOrder(id: string | null, input: OrderInput, submit: boolean): Promise<ActionResult & { id?: string }> {
  const who = await requirePurchasingActor();
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const data = parsed.data;
  const lines = data.lines.filter((l) => l.quantity > 0);
  if (submit && lines.length === 0) return fail("Add at least one product to send it for approval.");
  if (new Set(lines.map((l) => JSON.stringify([l.productId, l.size, l.colour]))).size !== lines.length) return fail("A product is on the order twice in the same size and colour. Put it on one line.");
  try { await requireCapFor("purchasing.request", { siteId: data.siteId, orgId: who.orgId }); }
  catch (error) { if (error instanceof AuthorizationError) return fail("You can only raise orders for the sites your role covers."); throw error; }
  const supplier = await prisma.supplier.findFirst({
    where: { id: data.supplierId, orgId: who.orgId ?? undefined, archivedAt: null },
    select: { name: true, products: { where: { archivedAt: null, id: { in: lines.map((l) => l.productId) } }, select: { id: true, name: true, code: true, unit: true, brand: true, sizes: true, colours: true, priceCents: true } } },
  });
  if (!supplier) return fail("That supplier is not approved to order from.");
  if (supplier.products.length !== new Set(lines.map((l) => l.productId)).size) return fail("Some of those products are no longer approved. Check the order again.");
  for (const l of lines) {
    const problem = variantProblem(supplier.products.find((x) => x.id === l.productId)!, l);
    if (problem) return fail(`${problem} Its sizes or colours may have changed; check the order again.`);
  }
  const rows = lines.map((l) => {
    const p = supplier.products.find((x) => x.id === l.productId)!;
    return { productId: p.id, name: p.name, code: p.code, unit: p.unit, brand: p.brand, size: l.size, colour: l.colour, unitPriceCents: p.priceCents, quantity: l.quantity };
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

/** The organisation's next running order number: one more than the highest in a
 *  "BT-OCT-0042" number so far (older "PO-BT-00001" numbers do not count). A lock held
 *  until the approval commits means two approvals at once never share a number. */
async function nextRunningNumber(tx: Prisma.TransactionClient, orgId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`purchase-order-number:${orgId}`}, 0))`;
  const pattern = `^[A-Z0-9]+-(${MONTHS.join("|")})-[0-9]+$`;
  const [row] = await tx.$queryRaw<{ last: number | null }[]>`
    SELECT MAX(CAST(split_part("number", '-', 3) AS INTEGER)) AS last FROM "PurchaseOrder"
    WHERE "orgId" = ${orgId} AND "number" ~ ${pattern}`;
  return (row?.last ?? 0) + 1;
}

/** Approve (giving it the site's next number) or reject (with the reason) an
 *  order waiting for approval. Needs a role the rules name for that supplier
 *  and amount, the order's site in reach, and never your own order unless you are an
 *  administrator (owner decision, 15 October 2026). */
export async function decideOrder(id: string, decision: "approve" | "reject", note: string): Promise<ActionResult> {
  const who = await requirePurchasingActor();
  const reason = note.trim().slice(0, 1000);
  if (decision === "reject" && reason.length < 3) return fail("Say why it is rejected, so the requester can change it.");
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: { orgId: true, status: true, siteId: true, supplierId: true, totalCents: true, requestedById: true, supplier: { select: { name: true } } },
  }).then(async (row) => row && (await withSiteStatus([row], "siteId", "site"))[0]);
  if (!order) return fail("That order no longer exists.");
  if (order.status !== "pending") return fail("That order is not waiting for approval any more.");
  const own = order.requestedById === who.id;
  if (own && !who.admin) return fail("Someone else has to approve your own order.");
  const sites = await sitesFor("purchasing.read");
  if (sites.kind !== "all" && !sites.siteIds.has(order.siteId)) return fail("That order is for a site your role does not cover.");
  if (!who.superadmin) {
    const [rules, roleId] = await Promise.all([
      prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined }, select: { supplierId: true, roleId: true, limitCents: true } }),
      staffRoleIdOf(who.id),
    ]);
    if (!mayApprove(rules, order.supplierId, roleId, order.totalCents)) return fail(`Your role may not approve ${euro(order.totalCents)} from ${order.supplier.name}.`);
  }
  if (decision === "approve" && !order.site.code) return fail(`${order.site.name} has no short code yet, so the order cannot be numbered. Give it one in Admin, Sites (for example BT).`);
  const result = await prisma.$transaction(async (tx) => {
    // Claim the order first, so two approvers at once cannot both number it.
    const decidedAt = new Date();
    const claimed = await tx.purchaseOrder.updateMany({ where: { id, status: "pending" }, data: { status: decision === "approve" ? "approved" : "rejected", decidedById: who.id, decidedByName: who.name, decidedAt, decisionNote: reason } });
    if (claimed.count !== 1) return fail("Someone decided this order just now.");
    let number: string | null = null;
    if (decision === "approve") {
      number = poNumber(order.site.code!, decidedAt, await nextRunningNumber(tx, order.orgId));
      await tx.purchaseOrder.update({ where: { id }, data: { number } });
    }
    await logAudit({ actorId: who.id, actorName: who.name, action: decision === "approve" ? "approve" : "reject", entity: "PurchaseOrder", entityId: id, clubId: order.siteId,
      summary: decision === "approve" ? `Approved ${number}${own ? " (their own order)" : ""}: ${order.supplier.name}, ${euro(order.totalCents)}` : `Rejected ${own ? "their own order" : "an order"} from ${order.supplier.name}, ${euro(order.totalCents)}: ${reason}` }, tx);
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

/* Emailing an approved order (owner request, 15 October 2026). */

const emailAddress = z.string().trim().email().max(254);
const NOT_SET_UP = "Email is not set up for Turnfin yet.";

/** Email an approved order: `test` sends the exact email to yourself; `supplier` sends
 *  it to the supplier's address, only once whoever manages Purchasing has turned emails
 *  to suppliers on. Replies go to whoever raised the order. Every attempt, sent or failed, is kept on
 *  the order and audited. */
export async function emailOrder(id: string, kind: "test" | "supplier"): Promise<ActionResult> {
  const who = await requirePurchasingActor();
  const ctx = await orderEmailContext(id, who);
  if (!ctx) return fail("That order no longer exists.");
  if (!ctx.mayEmail || !ctx.input) return fail("Only an approved order can be emailed, by someone who may raise orders at its site.");
  const supplier = ctx.order.supplier;
  const me = emailAddress.safeParse(ctx.sender.email);
  const replyTo = emailAddress.safeParse(ctx.replyTo.email);
  let to: string;
  if (kind === "test") {
    if (!me.success) return fail("Your account has no email address, so a test cannot reach you. Ask an administrator to add one.");
    to = me.data;
  } else {
    if (!ctx.emailsOn) return fail("Emails to suppliers are off. Send yourself a test first; whoever manages Purchasing turns them on under Suppliers.");
    const address = emailAddress.safeParse(supplier.email);
    if (!address.success) return fail(`${supplier.name} has no valid email address. Add one on the supplier's page.`);
    to = address.data;
  }
  // Supplier emails copy whoever raised the order and everyone Suppliers lists; tests go to the sender only.
  const copies = kind === "supplier" ? ctx.supplierCopies.filter((a) => emailAddress.safeParse(a).success && a.toLowerCase() !== to.toLowerCase()) : [];
  const cc = copies.length ? copies : undefined;
  const message = orderEmail(ctx.input, kind === "test");
  const config = emailSender(`${ctx.input.organisation} Purchasing`.trim());
  let error = "";
  try {
    if (!config) throw new Error(NOT_SET_UP);
    const logo = { cid: PO_EMAIL_LOGO_CID, filename: "leisureworld.png", contentType: "image/png" as const, content: await emailLogo() };
    await sendGoogleEmail(to, message.subject, { text: message.text, html: message.html, inlineImages: [logo], cc, replyTo: replyTo.success ? replyTo.data : undefined }, config);
  } catch (failure) {
    error = failure instanceof Error && failure.message === NOT_SET_UP ? NOT_SET_UP : "The email service did not accept it.";
  }
  const what = kind === "test" ? `a test of ${ctx.input.number} to themselves` : `${ctx.input.number} to ${supplier.name}`;
  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrderEmail.create({ data: { orderId: id, kind, toAddress: to, ccAddress: copies.join(", "), sentById: who.id, sentByName: who.name, status: error ? "failed" : "sent", error } });
    await logAudit({ actorId: who.id, actorName: who.name, action: "email", entity: "PurchaseOrder", entityId: id, clubId: ctx.order.siteId,
      summary: `${error ? "Could not email" : "Emailed"} ${what} (${to}${copies.length ? `, copy to ${copies.join(", ")}` : ""})${error ? `: ${error}` : ""}` }, tx);
  });
  revalidate(id);
  if (!error) return ok();
  return fail(error === NOT_SET_UP ? `${error} Nothing was sent; tell whoever looks after Turnfin.` : `${error} Nothing was sent; try again, and if it keeps failing tell whoever looks after Turnfin.`);
}
