import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard } from "@/modules/contributions";

/** The rota on the home page. Everyone sees their own shifts in Turnfin Me. */
registerHomeCard({
  moduleId: "rota",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    if (!held.has("rota.view")) return [];
    if (!held.has("rota.manage")) return [{ label: "This week's rota", href: "/rota" }];
    return [
      { label: "Plan this week's shifts", href: "/rota" },
      { label: "Absences", hint: "Report someone off sick or away", href: "/rota/absences" },
    ];
  },
});
