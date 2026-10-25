import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Site Monitoring. Actions belong to a site, so every page
 *  limits them to the sites `site-monitoring.read` covers (`sitesFor`) and closing one checks
 *  `site-monitoring.act` at its site (`mayFor`). */
export type MonitoringActor = { id: string; name: string; orgId: string | null; superadmin: boolean; act: boolean };

export function monitoringAccess(session: Session): MonitoringActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "site-monitoring.read")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin, act: holdsAnywhere(actor, "site-monitoring.act") };
}

export async function requireMonitoringActor() {
  const who = monitoringAccess(await requireSession());
  if (!who) throw new AuthorizationError("Site Monitoring access is required.");
  return who;
}
