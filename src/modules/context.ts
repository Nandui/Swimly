import type { Session } from "next-auth";
import { permissionsOf } from "@/lib/authz";
import { visibleScreens } from "@/lib/staff/screens";
import { visibleModules, type ModuleContext } from "./registry";

/** What the registry needs to know about the signed-in person. */
export function moduleContext(session: Session): ModuleContext {
  const permissions = permissionsOf(session);
  return { permissions, screens: visibleScreens(session.user.screens ?? [], permissions), superadmin: session.user.isSuperadmin === true };
}

export function modulesFor(session: Session) {
  return visibleModules(moduleContext(session));
}
