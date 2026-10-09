import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { sitesFor } from "@/lib/policy/session";
import { requirePurchasingActor, type PurchasingActor } from "@/modules/purchasing/lib/access";
import { EDITABLE, approverRoles, mayApprove, type PoStatus } from "@/modules/purchasing/lib/rules";

/** Purchasing's reads (docs/purchasing.md). Orders are limited to the sites
 *  `purchasing.read` covers; suppliers and products belong to the organisation. */

type Sites = Awaited<ReturnType<typeof sitesFor>>;
const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);

/** The approval rules and the person's own role: what they may approve. */
async function approvalContext(who: PurchasingActor) {
  const [rules, me] = await Promise.all([
    prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined }, select: { id: true, supplierId: true, roleId: true, limitCents: true, role: { select: { name: true } } } }),
    prisma.user.findUnique({ where: { id: who.id }, select: { staffRoleId: true } }),
  ]);
  const can = (o: { supplierId: string; totalCents: number; requestedById: string }) =>
    o.requestedById !== who.id && (who.superadmin || mayApprove(rules, o.supplierId, me?.staffRoleId ?? null, o.totalCents));
  return { rules, roleId: me?.staffRoleId ?? null, can };
}

const ORDER_ROW = {
  id: true, number: true, status: true, siteId: true, supplierId: true, totalCents: true, requestedById: true, requestedByName: true,
  neededBy: true, submittedAt: true, decidedAt: true, decidedByName: true, createdAt: true,
  site: { select: { name: true, code: true } }, supplier: { select: { name: true } }, _count: { select: { lines: true } },
} as const;

/** The first page: orders waiting for this person's approval, their own, and
 *  the latest at their sites. */
export async function purchasingHome() {
  const who = await requirePurchasingActor();
  const sites = await sitesFor("purchasing.read");
  const { can } = await approvalContext(who);
  const [pending, mine, recent, suppliers] = await Promise.all([
    prisma.purchaseOrder.findMany({ where: { orgId: who.orgId ?? undefined, status: "pending", ...inSites(sites) }, orderBy: { submittedAt: "asc" }, select: ORDER_ROW }),
    prisma.purchaseOrder.findMany({ where: { requestedById: who.id, status: { not: "cancelled" } }, orderBy: { updatedAt: "desc" }, take: 20, select: ORDER_ROW }),
    prisma.purchaseOrder.findMany({ where: { orgId: who.orgId ?? undefined, status: { in: ["pending", "approved", "rejected"] }, ...inSites(sites) }, orderBy: { updatedAt: "desc" }, take: 30, select: ORDER_ROW }),
    prisma.supplier.count({ where: { orgId: who.orgId ?? undefined, archivedAt: null } }),
  ]);
  return { who, waiting: pending.filter(can), mine, recent, suppliers };
}
export type OrderRow = Awaited<ReturnType<typeof purchasingHome>>["mine"][number];

/** One order, with what this person may do with it. A 404 outside their sites. */
export async function purchaseOrder(id: string) {
  const who = await requirePurchasingActor();
  const order = await prisma.purchaseOrder.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      ...ORDER_ROW, note: true, decisionNote: true, cancelledAt: true, updatedAt: true,
      supplier: { select: { name: true, accountNumber: true, contactName: true, email: true, phone: true } },
      lines: { orderBy: { name: "asc" }, select: { id: true, productId: true, name: true, code: true, unit: true, unitPriceCents: true, quantity: true } },
    },
  });
  if (!order) notFound();
  const sites = await sitesFor("purchasing.read");
  // Your own drafts are yours wherever they are; everything else follows your sites.
  if (!covers(sites, order.siteId) && order.requestedById !== who.id) notFound();
  if (order.status === "draft" && order.requestedById !== who.id && !who.manage) notFound();
  const { rules, can } = await approvalContext(who);
  const roleIds = approverRoles(rules, order.supplierId, order.totalCents);
  const roles = roleIds.map((id) => rules.find((r) => r.roleId === id)!.role.name);
  const mine = order.requestedById === who.id;
  const status = order.status as PoStatus;
  return {
    who, order: { ...order, status },
    approverRoles: roles,
    canApprove: status === "pending" && can(order),
    canEdit: mine && EDITABLE.includes(status),
    canCancel: (mine || who.manage) && ["draft", "pending", "rejected"].includes(status),
  };
}

/** What a new order (or a change to one) can be made of: the sites this person
 *  may order for, and the approved suppliers with their approved products. */
export async function orderForm(orderId?: string) {
  const who = await requirePurchasingActor();
  const [sites, all] = await Promise.all([
    sitesFor("purchasing.request"),
    prisma.club.findMany({ where: { orgId: who.orgId ?? undefined, archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true } }),
  ]);
  const suppliers = await prisma.supplier.findMany({
    where: { orgId: who.orgId ?? undefined, archivedAt: null, products: { some: { archivedAt: null } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, products: { where: { archivedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, unit: true, priceCents: true } } },
  });
  const { rules } = await approvalContext(who);
  const roles = await prisma.staffRole.findMany({ where: { id: { in: [...new Set(rules.map((r) => r.roleId))] } }, select: { id: true, name: true } });
  const existing = orderId ? await prisma.purchaseOrder.findFirst({
    where: { id: orderId, requestedById: who.id, status: { in: [...EDITABLE] } },
    select: { id: true, siteId: true, supplierId: true, neededBy: true, note: true, status: true, decisionNote: true, lines: { select: { productId: true, quantity: true } } },
  }) : null;
  if (orderId && !existing) notFound();
  return {
    who, suppliers, existing,
    sites: all.filter((s) => covers(sites, s.id)),
    rules: rules.map(({ supplierId, roleId, limitCents }) => ({ supplierId, roleId, limitCents })),
    roleNames: Object.fromEntries(roles.map((r) => [r.id, r.name])),
  };
}

/** Every approved supplier (archived last) with its products and approvers, and the rules for every supplier. */
export async function suppliersPage() {
  const who = await requirePurchasingActor();
  const orgId = who.orgId ?? undefined;
  const [suppliers, rules, roles] = await Promise.all([
    prisma.supplier.findMany({
      where: { orgId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true, accountNumber: true, contactName: true, email: true, phone: true, note: true, archivedAt: true,
        _count: { select: { products: { where: { archivedAt: null } }, orders: true } } },
    }),
    prisma.purchaseApprovalRule.findMany({ where: { orgId }, orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, supplierId: true, roleId: true, limitCents: true, role: { select: { name: true } } } }),
    prisma.staffRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { who, suppliers, rules, roles };
}

/** One supplier: details, approved products (archived last) and its own approvers. */
export async function supplierPage(id: string) {
  const who = await requirePurchasingActor();
  const supplier = await prisma.supplier.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      id: true, name: true, accountNumber: true, contactName: true, email: true, phone: true, note: true, archivedAt: true,
      products: { orderBy: [{ archivedAt: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, unit: true, priceCents: true, archivedAt: true } },
      rules: { orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, roleId: true, limitCents: true, role: { select: { name: true } } } },
    },
  });
  if (!supplier) notFound();
  const [roles, general] = await Promise.all([
    prisma.staffRole.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined, supplierId: null }, orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, limitCents: true, role: { select: { name: true } } } }),
  ]);
  return { who, supplier, roles, general };
}
