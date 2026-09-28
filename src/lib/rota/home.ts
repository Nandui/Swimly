import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard } from "@/modules/contributions";

/** The rota on the home page. Everyone sees their own shifts in Turnfin Me. */
registerHomeCard({
  moduleId: "rota",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("rota.view")) return [];
    return [{ label: held.has("rota.manage") ? "Plan this week's shifts" : "This week's rota", href: "/rota" }];
  },
});
