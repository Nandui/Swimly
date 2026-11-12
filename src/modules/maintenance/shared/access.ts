import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession, sitesFor } from "@/lib/policy/session";

/** Who may open Maintenance: anyone who may report at some site. A request belongs to a site, so
 *  every list and page limits requests to the sites `maintenance.report` covers (`sitesFor`), and
 *  each move checks `maintenance.manage` at the request's site (`mayFor`). */
export type MaintenanceActor = { id: string; name: string; orgId: string | null; superadmin: boolean; manage: boolean };

export function maintenanceAccess(session: Session): MaintenanceActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "maintenance.report")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin, manage: holdsAnywhere(actor, "maintenance.manage") };
}

export async function requireMaintenanceActor() {
  const who = maintenanceAccess(await requireSession());
  if (!who) throw new AuthorizationError("Maintenance access is required.");
  return who;
}

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
/** A where-clause for the sites a grant covers. */
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
