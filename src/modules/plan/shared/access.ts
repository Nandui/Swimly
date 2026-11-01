import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Plan (test). View reads the plan at their sites; Plan also plans the departments
 *  they belong to; Manage plans every department, runs today and keeps the setup. Every write
 *  checks the site again (`shared/scope.ts`). */
export type PlanActor = { id: string; name: string; orgId: string | null; superadmin: boolean; plan: boolean; manage: boolean };

export function planAccess(session: Session): PlanActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "plan.view")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    plan: holdsAnywhere(actor, "plan.plan"), manage: holdsAnywhere(actor, "plan.manage") };
}

export async function requirePlanActor() {
  const who = planAccess(await requireSession());
  if (!who) throw new AuthorizationError("Plan (test) access is required.");
  return who;
}
