import type { Session } from "next-auth";
import { permissionsOf } from "@/lib/authz";
import { expandPermissions } from "@/lib/staff/permissions";
import { visibleModules, type ModuleContext } from "./registry";

/** Everything the person holds anywhere: at the site they are working in,
 *  their other sites and over their team, so a module they use elsewhere is
 *  still on their home page. Each module page checks again where it applies. */
export function moduleContext(session: Session): ModuleContext {
  const grants = (session.user.grants ?? []).flatMap((grant) => grant.permissions);
  return { permissions: new Set([...permissionsOf(session), ...expandPermissions(grants)]) };
}

export function modulesFor(session: Session) {
  return visibleModules(moduleContext(session));
}
