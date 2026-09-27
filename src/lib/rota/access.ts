import "server-only";
import type { Session } from "next-auth";
import { canSee, requireSession, AuthorizationError } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the Rota workspace. Shifts belong to a site, so every page
 *  limits them to the sites the capability covers (`sitesFor`); a duty
 *  manager's site-scoped role opens it for their site only. Seeing your own
 *  shifts needs none of this: it lives in the My hub (`/me/shifts`). */
export type RotaActor = { id: string; name: string; orgId: string | null; manage: boolean };

export function rotaAccess(session: Session): RotaActor | null {
  const actor = actorForSession(session);
  const screen = canSee(session, "rota") || actor.superadmin || actor.grants.some((grant) => grant.screens.includes("rota"));
  if (!screen || !holdsAnywhere(actor, "rota.view")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, manage: holdsAnywhere(actor, "rota.manage") };
}

export async function requireRotaActor() {
  const who = rotaAccess(await requireSession());
  if (!who) throw new AuthorizationError("Rota access is required.");
  return who;
}
