import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Purchasing (docs/purchasing.md). Orders belong to a site, so
 *  every page limits them to the sites the capability covers (`sitesFor`).
 *  Approving needs no permission of its own: the approval rules name the
 *  roles, and each approver must see the order's site. */
export type PurchasingActor = { id: string; name: string; orgId: string | null; superadmin: boolean; request: boolean; manage: boolean };

export function purchasingAccess(session: Session): PurchasingActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "purchasing.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    request: holdsAnywhere(actor, "purchasing.request"), manage: holdsAnywhere(actor, "purchasing.manage"),
  };
}

export async function requirePurchasingActor() {
  const who = purchasingAccess(await requireSession());
  if (!who) throw new AuthorizationError("Purchasing access is required.");
  return who;
}
