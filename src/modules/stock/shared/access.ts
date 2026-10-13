import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Stock (docs/stock.md). Counts belong to a site, so every page limits them to the
 *  sites the capability covers (`sitesFor`) and every write checks the count's site (`mayFor`).
 *  The product list and its categories are the organisation's, kept with Manage. */
export type StockActor = { id: string; name: string; orgId: string | null; superadmin: boolean; count: boolean; manage: boolean };

export function stockAccess(session: Session): StockActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "stock.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    count: holdsAnywhere(actor, "stock.count"), manage: holdsAnywhere(actor, "stock.manage"),
  };
}

export async function requireStockActor() {
  const who = stockAccess(await requireSession());
  if (!who) throw new AuthorizationError("Stock access is required.");
  return who;
}
