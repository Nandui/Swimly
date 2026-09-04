/** Permissions, asked one question at a time.
 *
 *  This used to be three fixed tiers — admin, manage, view — mapped from an
 *  enum. That was a deliberate decision and it held for as long as the club
 *  had three kinds of person. It stopped holding the moment a role was needed
 *  that could edit the timetable but not accounts, which is neither "changes
 *  the rules" nor "changes the data". Rather than grow a fourth tier and then
 *  a fifth, roles became data: `StaffRole` rows carrying an explicit list of
 *  keys from `src/lib/staff/permissions.ts`.
 *
 *  What has **not** changed is where the answer is asked. Every screen and
 *  action asks for one permission by name, never for a role. Nothing in the
 *  app refers to a role by its name, which is what lets an admin rename or
 *  delete one without breaking anything.
 *
 *  The three guards, still guarding different things:
 *
 *    the nav   hides what you cannot reach   `visibleNavItems`
 *    the page  declines to exist             `src/lib/page-guards.ts`
 *    the action refuses the call             `requirePermission`, here
 *
 *  Only the last is security. The other two are courtesy. */

import type { Session } from "next-auth";
import { auth } from "@/auth";
import { expandPermissions, type PermissionKey } from "@/lib/staff/permissions";
import { visibleScreens, type ScreenKey } from "@/lib/staff/screens";

export type { PermissionKey };

export class AuthorizationError extends Error {}

/** Returns the session or throws. Use in data modules for read access.
 *
 *  Reads are open to anyone signed in, which is the behaviour the app has
 *  always had. Only writes and the audit log are permissioned. */
export async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new AuthorizationError("Not signed in");
  return session;
}

/** Expanded on every call rather than cached on the session, because the
 *  session is rebuilt per request anyway and a stale permission set is exactly
 *  the bug this whole file exists to avoid. The lists are single digits long. */
export function permissionsOf(session: Session): Set<PermissionKey> {
  return expandPermissions(session.user.permissions ?? []);
}

export function can(session: Session, permission: PermissionKey): boolean {
  return permissionsOf(session).has(permission);
}

/** Whether this person's role offers a screen at all — and they hold what
 *  the screen requires. Pages ask this before they ask anything else; links
 *  that cross into another screen ask it before they render. */
export function canSee(session: Session, screen: ScreenKey): boolean {
  return visibleScreens(session.user.screens ?? [], permissionsOf(session)).has(screen);
}

/** True if the session holds **any** of these. For screens that exist to serve
 *  several permissions at once — the Today page is reachable by anyone who can
 *  take a register, however they came by it. */
export function canAny(session: Session, ...permissions: PermissionKey[]): boolean {
  const held = permissionsOf(session);
  return permissions.some((permission) => held.has(permission));
}

/** Requires one named permission. Every mutating action starts with one of
 *  these, and it throws rather than returning a result: being called without
 *  permission is not something a person can fix by typing something else. */
export async function requirePermission(permission: PermissionKey) {
  const session = await requireSession();
  if (!can(session, permission)) {
    throw new AuthorizationError(`You do not have permission to do that (${permission})`);
  }
  return session;
}

/** Requires any one of several. Same contract as `requirePermission`. */
export async function requireAnyPermission(...permissions: PermissionKey[]) {
  const session = await requireSession();
  if (!canAny(session, ...permissions)) {
    throw new AuthorizationError(
      `You do not have permission to do that (${permissions.join(" or ")})`
    );
  }
  return session;
}
