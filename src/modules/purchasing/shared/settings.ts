import "server-only";
import { prisma } from "@/lib/prisma";

/** Whether approved orders may be emailed to suppliers in this organisation. Off until
 *  someone with Purchasing: Manage turns it on; tests to yourself
 *  are always allowed. */
export async function supplierEmailsOn(orgId: string | null): Promise<boolean> {
  if (!orgId) return false;
  return (await prisma.purchasingSettings.findUnique({ where: { orgId }, select: { supplierEmailsOn: true } }))?.supplierEmailsOn ?? false;
}

/** The addresses copied (CC) on every email to a supplier, as stored ("a@x, b@y"); empty for none. */
export async function supplierEmailCopy(orgId: string | null): Promise<string> {
  if (!orgId) return "";
  return (await prisma.purchasingSettings.findUnique({ where: { orgId }, select: { copyTo: true } }))?.copyTo ?? "";
}

/** The switch as the Suppliers page shows it: on or off, who last changed it, and
 *  whether anyone has sent a test yet (it cannot be turned on before one). */
export async function supplierEmailSetting(orgId: string | null) {
  const [row, tested] = await Promise.all([
    orgId ? prisma.purchasingSettings.findUnique({ where: { orgId } }) : null,
    prisma.purchaseOrderEmail.count({ where: { kind: "test", status: "sent", order: { orgId: orgId ?? undefined } } }),
  ]);
  return { on: row?.supplierEmailsOn ?? false, copyTo: row?.copyTo ?? "", changedByName: row?.changedByName ?? null, changedAt: row?.updatedAt ?? null, tested: tested > 0 };
}
