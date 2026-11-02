import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";
import { requirePaymentsActor } from "@/modules/payments/shared/access";
import { followUpCounts } from "@/modules/payments/features/failures/server/data";

/** Payments on Home and its starter page (registered in module.ts). Reception sees the failed
 *  payments nobody has contacted yet at their sites, and those waiting on the member; Manage gets
 *  the upload as a quick action. */
export async function paymentsHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("payments.read")) return [];
  const who = await requirePaymentsActor();
  const items: HomeItem[] = [];
  if (who.follow) {
    const { toContact, contacted } = await followUpCounts(who.orgId);
    items.push({ label: "Failed payments to contact", hint: "Direct debits nobody has chased yet", href: "/payments?show=to_contact", count: toContact, attention: toContact > 0 });
    if (contacted) items.push({ label: "Failed payments waiting on the member", hint: "Contacted, not recovered yet", href: "/payments?show=contacted", count: contacted });
  }
  if (who.manage) items.push({ kind: "action", icon: "filePlus", label: "Upload the failure sheet", href: "/payments/upload" });
  return items;
}
