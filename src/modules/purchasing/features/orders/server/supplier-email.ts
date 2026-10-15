import "server-only";
import { organisationName, staffContact, withSiteStatus } from "@/lib/directory";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import type { PurchasingActor } from "@/modules/purchasing/shared/access";
import { supplierEmailCopy, supplierEmailsOn } from "@/modules/purchasing/shared/settings";
import { orderEmail, type OrderEmailInput } from "@/modules/purchasing/features/orders/server/order-email";

/** What emailing an approved order needs, read once for the preview page and the send
 *  (docs/purchasing.md). Who may send it: whoever raised it, anyone who may raise
 *  orders at its site, and whoever manages Purchasing. Null when the order is not
 *  theirs to see. */
export async function orderEmailContext(id: string, who: PurchasingActor) {
  const found = await prisma.purchaseOrder.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      id: true, number: true, status: true, siteId: true, supplierId: true, requestedById: true, requestedByName: true, neededBy: true, decidedAt: true, note: true,
      supplier: { select: { name: true, contactName: true, email: true, accountNumber: true } },
      lines: { orderBy: [{ name: "asc" }, { id: "asc" }], select: { name: true, code: true, unit: true, brand: true, size: true, colour: true, quantity: true } },
      emails: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, toAddress: true, ccAddress: true, sentByName: true, status: true, error: true, createdAt: true } },
    },
  });
  if (!found) return null;
  const [order] = await withSiteStatus([found], "siteId", "site");
  const [read, request] = await Promise.all([sitesFor("purchasing.read"), sitesFor("purchasing.request")]);
  const covers = (s: typeof read) => s.kind === "all" || s.siteIds.has(order.siteId);
  const mine = order.requestedById === who.id;
  if (!covers(read) && !mine) return null;
  const [organisation, me, requester, emailsOn, copyTo] = await Promise.all([
    organisationName(who.orgId), staffContact(who.id, who.orgId), mine ? null : staffContact(order.requestedById, who.orgId), supplierEmailsOn(who.orgId), supplierEmailCopy(who.orgId),
  ]);
  const sender = { name: who.name, email: me?.email ?? "" };
  // Replies go to whoever raised the order (owner request, 15 October 2026), or to the
  // sender when that person has no email address any more.
  const raisedBy = mine ? sender : { name: requester?.name ?? order.requestedByName, email: requester?.email ?? "" };
  const replyTo = raisedBy.email.trim() ? raisedBy : sender;
  const input: OrderEmailInput | null = order.number ? {
    number: order.number, organisation, site: order.site.name, supplier: order.supplier,
    neededBy: order.neededBy ? formatDate(order.neededBy) : null, approvedOn: order.decidedAt ? formatDate(order.decidedAt) : null,
    note: order.note, lines: order.lines, sender, replyTo,
  } : null;
  return {
    order, emailsOn, copyTo, sender, replyTo, input,
    mayEmail: order.status === "approved" && order.number !== null && (mine || who.manage || covers(request)),
    // The preview shows the logo from Turnfin itself; the sent email carries it inside.
    preview: input ? orderEmail(input, false, "/purchasing/email-logo") : null,
  };
}
