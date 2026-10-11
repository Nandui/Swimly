import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession, sitesFor } from "@/lib/policy/session";
import type { IncidentsActor } from "@/modules/incidents/shared/types";

/** Who may open Incidents (docs/incidents.md): anyone who may report at some
 *  site. Reports belong to a site, so reading anyone else's needs
 *  `incidents.reports.review` at that site (`sitesFor`); your own you always see. */
export function incidentsAccess(session: Session): IncidentsActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "incidents.reports.create")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    review: holdsAnywhere(actor, "incidents.reports.review"), signoff: holdsAnywhere(actor, "incidents.reports.signoff"),
  };
}

export async function requireIncidentsActor() {
  const who = incidentsAccess(await requireSession());
  if (!who) throw new AuthorizationError("Incidents access is required.");
  return who;
}

export type Sites = Awaited<ReturnType<typeof sitesFor>>;
export const inSites = (sites: Sites) => (sites.kind === "all" ? {} : { siteId: { in: [...sites.siteIds] } });
export const covers = (sites: Sites, siteId: string) => sites.kind === "all" || sites.siteIds.has(siteId);
