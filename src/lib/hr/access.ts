import "server-only";
import type { Session } from "next-auth";
import { requireSession, AuthorizationError } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the HR workspace. Every HR capability is restricted: it
 *  reaches a person only through a role a superadmin assigned (or the
 *  superadmin flag), and each read also needs a recent password. Holding a
 *  capability anywhere opens the workspace; every page then limits records to
 *  the people it covers. What is shared with you lives in Turnfin Me (the staff app). */
export type HrActor = {
  id: string;
  name: string;
  orgId: string;
  superadmin: boolean;
  notes: boolean;
  reviews: boolean;
  /** Keeps staff details (position, employment, contact) for someone. */
  details: boolean;
};

export function hrAccess(session: Session): HrActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "hr.records.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId ?? "", superadmin: actor.superadmin,
    notes: holdsAnywhere(actor, "hr.notes.write"),
    reviews: holdsAnywhere(actor, "hr.reviews.write"),
    details: holdsAnywhere(actor, "hr.details.write"),
  };
}

export async function requireHrActor() {
  const who = hrAccess(await requireSession());
  if (!who) throw new AuthorizationError("HR access is required.");
  return who;
}
