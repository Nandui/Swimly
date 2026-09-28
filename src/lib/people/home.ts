import "server-only";
import { requirePermission } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Admin on the home page: people, roles and sites, and what waits to be checked. */
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
      items.push({ label: "Staff", href: "/staff" });
    }
    if (held.has("roles.manage")) items.push({ label: "Roles", href: "/roles" });
    if (held.has("clubs.manage")) items.push({ label: "Sites", href: "/clubs" });
    if (held.has("activity.view")) items.push({ label: "Activity log", href: "/activity" });
    return items;
  },
});
