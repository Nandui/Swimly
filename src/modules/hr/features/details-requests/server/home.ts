import "server-only";
import { requireSession } from "@/lib/authz";
import { pendingDetailChanges } from "@/lib/people/records";
import { subjectsFor } from "@/lib/policy/session";
import { expandPermissions } from "@/lib/staff/permissions";
import type { HomeItem, HomeViewer } from "@/modules/contributions";

/** HR on the home page: details changes from Turnfin Me waiting for someone who
 *  keeps those people's details. A count only: the home page never loads anyone's details.
 *  Registered in module.ts. */
export async function hrHomeItems(viewer: HomeViewer): Promise<HomeItem[]> {
  const held = expandPermissions(viewer.anywhere, { superadmin: viewer.isSuperadmin });
  const items: HomeItem[] = [];
  if (held.has("hr.details.write")) {
    const [session, scope] = await Promise.all([requireSession(), subjectsFor("hr.details.write")]);
    const pending = await pendingDetailChanges(session.user.orgId ?? null, scope);
    items.push({ label: "Details changes to check", hint: "Sent from Turnfin Me", href: "/hr/details-requests", count: pending, attention: pending > 0 });
  }
  return items;
}
