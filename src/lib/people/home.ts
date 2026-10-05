import "server-only";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Admin on the home page: what waits to be checked. Its pages are on its overview. */
registerHomeCard({
  moduleId: "admin",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("staff.manage")) {
      // A count only: the home page never loads anyone's details.
      const session = await requirePermission("staff.manage");
      const pending = await prisma.staffDetailChangeRequest.count({ where: { orgId: session.user.orgId ?? undefined, status: "PENDING" } });
      items.push({ label: "Details changes to check", hint: "Sent from Turnfin Me", href: "/staff/details-requests", count: pending, attention: pending > 0 });
      items.push({ kind: "action", icon: "userPlus", label: "Add person", href: "/staff?add=1" });
    }
    return items;
  },
});
