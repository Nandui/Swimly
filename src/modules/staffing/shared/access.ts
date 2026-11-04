import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Staffing, and what they hold anywhere (for menus and buttons). Everything in it
 *  belongs to a site, so every read limits itself to `sitesFor` and every write checks the
 *  record's site (`atSite`). Holding a level somewhere is presentation, never security. */
export type StaffingActor = { id: string; name: string; orgId: string | null; superadmin: boolean; run: boolean; supervise: boolean; manage: boolean };

export function staffingAccess(session: Session): StaffingActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "staffing.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    run: holdsAnywhere(actor, "staffing.run"), supervise: holdsAnywhere(actor, "staffing.supervise"), manage: holdsAnywhere(actor, "staffing.manage"),
  };
}

export async function requireStaffingActor() {
  const who = staffingAccess(await requireSession());
  if (!who) throw new AuthorizationError("Staffing access is required.");
  return who;
}
