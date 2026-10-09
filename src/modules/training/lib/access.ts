import "server-only";
import type { Session } from "next-auth";
import { requireSession, AuthorizationError } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the Training workspace (the Manage surface), and which of its
 *  jobs they have. Holding a capability anywhere opens the matching page;
 *  every page and action then limits records to the people that capability
 *  covers (`subjectsFor`, `requireCapFor`). Completing your own training needs
 *  none of this: it lives in Turnfin Me (the staff app). */
export type TrainingActor = {
  id: string;
  name: string;
  orgId: string | null;
  manage: boolean;
  assign: boolean;
  signoff: boolean;
  records: boolean;
  /** May check certificates uploaded in Turnfin Me (qualifications.manage). */
  qualifications: boolean;
};

export function trainingAccess(session: Session): TrainingActor | null {
  const actor = actorForSession(session);
  // Training is people-scoped: it opens for anyone holding the permission at
  // any of their sites; each page limits records to the people it covers.
  if (!holdsAnywhere(actor, "training.records.read")) return null;
  return {
    id: actor.id,
    name: actor.name,
    orgId: actor.orgId,
    manage: holdsAnywhere(actor, "training.manage"),
    assign: holdsAnywhere(actor, "training.assign"),
    signoff: holdsAnywhere(actor, "training.signoff"),
    records: true,
    qualifications: holdsAnywhere(actor, "qualifications.manage"),
  };
}

export async function requireTrainingActor() {
  const who = trainingAccess(await requireSession());
  if (!who) throw new AuthorizationError("Training access is required.");
  return who;
}
