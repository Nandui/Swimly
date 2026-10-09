import "server-only";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePurchasingActor } from "@/modules/purchasing/shared/access";

/** Purchasing's supplier reads (docs/purchasing.md): suppliers and products belong to the organisation. */

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
