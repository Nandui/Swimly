import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Short courses (docs/short-courses.md). Courses belong to a site, so every page
 *  limits them to the sites the capability covers (`sitesFor`) and every write checks the
 *  course's site (`mayFor`). The course list is the organisation's, kept with Manage. */
export type ShortCoursesActor = { id: string; name: string; orgId: string | null; superadmin: boolean; run: boolean; manage: boolean };

export function shortCoursesAccess(session: Session): ShortCoursesActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "short-courses.read")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    run: holdsAnywhere(actor, "short-courses.run"), manage: holdsAnywhere(actor, "short-courses.manage"),
  };
}

export async function requireShortCoursesActor() {
  const who = shortCoursesAccess(await requireSession());
  if (!who) throw new AuthorizationError("Short courses access is required.");
  return who;
}
