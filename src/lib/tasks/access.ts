import "server-only";
import type { Session } from "next-auth";
import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";

/** Who may open Tasks (docs/tasks.md). Tasks belong to a site, so every page
 *  limits them to the sites the capability covers (`sitesFor`); these flags
 *  only decide which pages and buttons show. */
export type TasksActor = { id: string; name: string; orgId: string | null; superadmin: boolean; review: boolean; manage: boolean };

export function tasksAccess(session: Session): TasksActor | null {
  const actor = actorForSession(session);
  if (!holdsAnywhere(actor, "tasks.complete")) return null;
  return {
    id: actor.id, name: actor.name, orgId: actor.orgId, superadmin: actor.superadmin,
    review: holdsAnywhere(actor, "tasks.review"), manage: holdsAnywhere(actor, "tasks.manage"),
  };
}

export async function requireTasksActor() {
  const who = tasksAccess(await requireSession());
  if (!who) throw new AuthorizationError("Tasks access is required.");
  return who;
}
