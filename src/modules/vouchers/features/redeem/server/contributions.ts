import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** Vouchers on the home page and its starter page: the one everyday job, checking a voucher at
 *  the desk. */
export async function voucherHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  if (!held.has("vouchers.redeem")) return [];
  return [{ kind: "action", icon: "receipt", label: "Redeem a voucher", href: "/vouchers" }];
}
