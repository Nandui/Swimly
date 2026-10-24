import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the CCTV log. Viewings belong to a site: Record reads only the
 *  person's own entries, Review every entry at the sites it covers (`sitesFor`), and every write
 *  checks the site (`mayFor`). */
export type CctvActor = { id: string; name: string; orgId: string | null; superadmin: boolean; review: boolean };

export function cctvAccess(session: Session): CctvActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "cctv.record")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin, review: holdsAnywhere(actor, "cctv.review") };
}

export async function requireCctvActor() {
  const who = cctvAccess(await requireSession());
  if (!who) throw new AuthorizationError("CCTV log access is required.");
  return who;
}
