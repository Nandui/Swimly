import "server-only";
import { expandPermissions } from "@/lib/staff/permissions";
import { registerHomeCard, type HomeItem } from "@/modules/contributions";

/** Docs on the home page. Confirming required reading happens in Turnfin Me. */
registerHomeCard({
  moduleId: "docs",
  async items(viewer) {
    const held = expandPermissions(viewer.permissions, { superadmin: viewer.isSuperadmin });
    if (!held.has("docs.read")) return [];
    const items: HomeItem[] = [{ label: "Documents", hint: "Procedures, policies and risk assessments", href: "/docs/library" }];
    if (held.has("docs.write")) items.unshift({ kind: "action", icon: "filePlus", label: "Add a document", href: "/docs/documents/new" });
    if (held.has("docs.write") || held.has("docs.approve")) items.push({ label: "Drafts and approvals", href: "/docs/work" });
    if (held.has("docs.manage")) items.push({ label: "Who has read what", href: "/docs/reports" });
    return items;
  },
});
