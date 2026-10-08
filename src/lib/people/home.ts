import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Admin on the home page: its quick action. Its pages are on its overview. */
registerHomeCard({
  moduleId: "admin",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("staff.manage")) items.push({ kind: "action", icon: "userPlus", label: "Add a person", href: "/staff?add=1" });
    return items;
  },
});
