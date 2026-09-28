import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard } from "@/modules/contributions";

/** HR on the home page: a link only. Nothing restricted is counted or shown
 *  outside HR, which asks for a fresh password when opened. */
registerHomeCard({
  moduleId: "hr",
  async items(viewer) {
    const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
    return held.has("hr.records.read") ? [{ label: "Notes and reviews", hint: "Asks for your password again", href: "/hr" }] : [];
  },
});
