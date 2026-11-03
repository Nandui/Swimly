import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Qualifications: anyone who keeps qualifications (`qualifications.manage`) at any
 *  of their sites. Every page and action then limits records to the people that covers
 *  (`subjectsFor`, `requireCapFor`), and nobody checks or logs their own. */
export type QualificationsActor = { id: string; name: string; orgId: string | null; superadmin: boolean };

export function qualificationsAccess(session: Session): QualificationsActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "qualifications.manage")) return null;
  return { id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin };
}

export async function requireQualificationsActor() {
  const who = qualificationsAccess(await requireSession());
  if (!who) throw new AuthorizationError("Qualifications access is required.");
  return who;
}
