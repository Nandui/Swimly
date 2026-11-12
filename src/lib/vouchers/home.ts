import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard } from "@/modules/contributions";

/** Vouchers on the home page: the one everyday job, checking a voucher at the
 *  desk. Batches are in the module's page bar. */
registerHomeCard({
  moduleId: "vouchers",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("vouchers.redeem")) return [];
    return [{ kind: "action", icon: "ticket", label: "Redeem a voucher", href: "/vouchers" }];
  },
});
