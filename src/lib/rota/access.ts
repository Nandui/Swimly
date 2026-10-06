import "server-only";
import type { Session } from "next-auth";
import { requireSession, AuthorizationError } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open the Rota workspace, and how far they go (owner decisions, 6 October 2026):
 *  View sees the rota; Plan plans the days ahead for the departments they belong to; Run
 *  (stored as `rota.manage`) changes any day for every department, reports absences and keeps
 *  the activity list. Everything belongs to a site, so each page and action asks again at that
 *  site (`sitesFor`, `requireCapFor`). Seeing your own days needs none of this: it lives in
 *  Turnfin Me. */
export type RotaActor = { id: string; name: string; orgId: string | null; plan: boolean; run: boolean };

export function rotaAccess(session: Session): RotaActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "rota.view")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, plan: holdsAnywhere(actor, "rota.plan"), run: holdsAnywhere(actor, "rota.manage") };
}

export async function requireRotaActor() {
  const who = rotaAccess(await requireSession());
  if (!who) throw new AuthorizationError("Rota access is required.");
  return who;
}

/** May this person change this day of this department's plan? Run changes any day; Plan only
 *  the days after today, and only for a department they belong to. */
export function canChange(at: { plan: boolean; run: boolean }, date: string, today: string, departmentId: string, memberOf: ReadonlySet<string>) {
  if (at.run) return true;
  return at.plan && date > today && memberOf.has(departmentId);
}
