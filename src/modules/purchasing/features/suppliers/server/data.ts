import "server-only";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { allRoles, withRoles } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { purchasingAccess, requirePurchasingActor } from "@/modules/purchasing/shared/access";
import { supplierEmailSetting } from "@/modules/purchasing/shared/settings";

/** Purchasing's supplier reads (docs/purchasing.md): suppliers and products belong to the organisation. */

/** Every approved supplier (archived last) with its products and approvers, and the rules for every supplier. */
export async function suppliersPage() {
  const who = await requirePurchasingActor();
  const orgId = who.orgId ?? undefined;
  const [suppliers, rules, roles, emails] = await Promise.all([
    prisma.supplier.findMany({
      where: { orgId }, orderBy: [{ archivedAt: "asc" }, { name: "asc" }],
      select: { id: true, name: true, pictureVersion: true, accountNumber: true, contactName: true, email: true, phone: true, note: true, archivedAt: true,
        _count: { select: { products: { where: { archivedAt: null } }, orders: true } } },
    }),
    prisma.purchaseApprovalRule.findMany({ where: { orgId }, orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, supplierId: true, roleId: true, limitCents: true } }).then((rows) => withRoles(rows, "roleId", "role")),
    allRoles(),
    supplierEmailSetting(who.orgId),
  ]);
  return { who, suppliers, rules, roles, emails };
}

/** One supplier: details, approved products (archived last) and its own approvers. */
export async function supplierPage(id: string) {
  const who = await requirePurchasingActor();
  const found = await prisma.supplier.findFirst({
    where: { id, orgId: who.orgId ?? undefined },
    select: {
      id: true, name: true, pictureVersion: true, accountNumber: true, contactName: true, email: true, phone: true, note: true, archivedAt: true,
      products: { orderBy: [{ archivedAt: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, unit: true, brand: true, sizes: true, colours: true, priceCents: true, archivedAt: true } },
      rules: { orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, roleId: true, limitCents: true } },
    },
  });
  if (!found) notFound();
  const [rules, roles, general] = await Promise.all([
    withRoles(found.rules, "roleId", "role"),
    allRoles(),
    prisma.purchaseApprovalRule.findMany({ where: { orgId: who.orgId ?? undefined, supplierId: null }, orderBy: [{ limitCents: { sort: "asc", nulls: "last" } }], select: { id: true, roleId: true, limitCents: true } }).then((rows) => withRoles(rows, "roleId", "role")),
  ]);
  return { who, supplier: { ...found, rules }, roles, general };
}

/** A supplier's picture for whoever may open Purchasing, by the version in its address;
 *  null when they may not, it has none, or it has changed since. */
export async function supplierPicture(id: string, version: string | null) {
  const session = await auth();
  const who = session?.user ? purchasingAccess(session) : null;
  if (!who || !version) return null;
  const row = await prisma.supplier.findFirst({ where: { id, orgId: who.orgId ?? undefined }, select: { pictureData: true, pictureVersion: true } });
  return row?.pictureData && row.pictureVersion === version ? { bytes: row.pictureData, version: row.pictureVersion } : null;
}
