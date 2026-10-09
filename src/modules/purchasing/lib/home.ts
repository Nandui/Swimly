import "server-only";
import { purchasingHome } from "@/modules/purchasing/lib/data";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Purchasing on the home page: orders waiting for this person's approval,
 *  their own rejected ones to change, and raising a new order. Its pages are
 *  in the module's page bar. */
registerHomeCard({
  moduleId: "purchasing",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("purchasing.read")) return [];
    const { waiting, mine } = await purchasingHome();
    const items: HomeItem[] = [];
    if (waiting.length) items.push({ label: "Purchase orders to approve", href: "/purchasing#po-waiting", count: waiting.length, attention: true });
    const rejected = mine.filter((o) => o.status === "rejected").length;
    if (rejected) items.push({ label: "Your rejected orders to change", href: "/purchasing#po-mine", count: rejected, attention: true });
    if (held.has("purchasing.request")) items.push({ kind: "action", icon: "filePlus", label: "Raise a purchase order", href: "/purchasing/new" });
    return items;
  },
});
