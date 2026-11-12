import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession, sitesFor } from "@/lib/policy/session";

/** Who may open Payments: anyone who may see failed payments at some site. A failure belongs to a
 *  site, so every list and page limits failures to the sites `payments.read` covers (`sitesFor`),
 *  and each step checks its own permission at the failure's site (`mayFor`). */
export type PaymentsActor = { id: string; name: string; orgId: string | null; superadmin: boolean; follow: boolean; manage: boolean };

export function paymentsAccess(session: Session): PaymentsActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "payments.read")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    follow: holdsAnywhere(actor, "payments.follow"), manage: holdsAnywhere(actor, "payments.manage") };
}

export async function requirePaymentsActor() {
  const who = paymentsAccess(await requireSession());
  if (!who) throw new AuthorizationError("Payments access is required.");
  return who;
}

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
/** A where-clause for the sites a grant covers. */
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
