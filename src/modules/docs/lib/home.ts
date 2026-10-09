import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Docs on the home page: the writer's quick action. Its pages are in its own
 *  overview, and confirming required reading happens in Turnfin Me. */
registerHomeCard({
  moduleId: "docs",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    const items: HomeItem[] = [];
    if (held.has("docs.read") && held.has("docs.write")) items.push({ kind: "action", icon: "filePlus", label: "Add a document", href: "/docs/documents/new" });
    return items;
  },
});
