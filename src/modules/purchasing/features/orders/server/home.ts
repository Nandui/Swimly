import "server-only";
import { purchasingHome } from "@/modules/purchasing/features/orders/server/data";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** Purchasing on the home page: orders waiting for this person's approval,
 *  their own rejected ones to change, and raising a new order. Its pages are
 *  in the module's page bar. Registered in module.ts. */
export async function purchasingHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("purchasing.read")) return [];
  const { waiting, mine } = await purchasingHome();
  const items: HomeItem[] = [];
  if (waiting.length) items.push({ label: "Purchase orders to approve", href: "/purchasing#po-waiting", count: waiting.length, attention: true });
  const rejected = mine.filter((o) => o.status === "rejected").length;
  if (rejected) items.push({ label: "Your rejected orders to change", href: "/purchasing#po-mine", count: rejected, attention: true });
  if (held.has("purchasing.request")) items.push({ kind: "action", icon: "filePlus", label: "Raise a purchase order", href: "/purchasing/new" });
  return items;
}
