import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the Academy (docs/academy.md). Courses belong to a site, so every page limits
 *  them to the sites the capability covers (`sitesFor`) and every write checks the course's
 *  site (`mayFor`). The course list is the organisation's, kept with Manage. */
export type AcademyActor = { id: string; name: string; orgId: string | null; superadmin: boolean; run: boolean; manage: boolean };

export function academyAccess(session: Session): AcademyActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "academy.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    run: holdsAnywhere(actor, "academy.run"), manage: holdsAnywhere(actor, "academy.manage"),
  };
}

export async function requireAcademyActor() {
  const who = academyAccess(await requireSession());
  if (!who) throw new AuthorizationError("Academy access is required.");
  return who;
}
