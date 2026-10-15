import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { ADMINISTRATOR_PERMISSIONS } from "@/lib/staff/permissions";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Purchasing (docs/purchasing.md). Orders belong to a site, so
 *  every page limits them to the sites the capability covers (`sitesFor`).
 *  Approving needs no permission of its own: the approval rules name the
 *  roles, and each approver must see the order's site. Administrators (and superadmins)
 *  may also approve their own orders (owner decision, 15 October 2026); nobody else may. */
export type PurchasingActor = { id: string; name: string; orgId: string | null; superadmin: boolean; admin: boolean; request: boolean; manage: boolean };

export function purchasingAccess(session: Session): PurchasingActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "purchasing.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    admin: actor.superadmin || ADMINISTRATOR_PERMISSIONS.every((key) => holdsAnywhere(actor, key)),
    request: holdsAnywhere(actor, "purchasing.request"), manage: holdsAnywhere(actor, "purchasing.manage"),
  };
}

export async function requirePurchasingActor() {
  const who = purchasingAccess(await requireSession());
  if (!who) throw new AuthorizationError("Purchasing access is required.");
  return who;
}
