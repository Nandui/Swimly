import "server-only";
import type { Session } from "next-auth";
import { canSee, requireSession, AuthorizationError } from "@/lib/authz";
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
};

export function trainingAccess(session: Session): TrainingActor | null {
  const actor = actorForSession(session);
  // Training is people-scoped: a department or team role with the Training
  // screen opens it too, unlike the flat site-based screens.
  const screen = canSee(session, "training") || actor.superadmin || actor.grants.some((grant) => grant.screens.includes("training"));
  if (!screen || !holdsAnywhere(actor, "training.records.read")) return null;
  return {
    id: actor.id,
    name: actor.name,
    orgId: actor.orgId,
    manage: holdsAnywhere(actor, "training.manage"),
    assign: holdsAnywhere(actor, "training.assign"),
    signoff: holdsAnywhere(actor, "training.signoff"),
    records: true,
  };
}

export async function requireTrainingActor() {
  const who = trainingAccess(await requireSession());
  if (!who) throw new AuthorizationError("Training access is required.");
  return who;
}
