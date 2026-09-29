import { cookies } from "next/headers";
import { devSignInAllowed } from "@/lib/dev-sign-in";
import { prisma } from "@/lib/prisma";
import { expandPermissions } from "@/lib/staff/permissions";
import { ACCOUNT_SELECT } from "@/lib/staff/session-user";

/** Seeing the app as another role would — a dev-build affordance.
 *
 *  Somebody who defines roles needs to see what each one gets: which
 *  pages, which buttons, which home page. Signing in and out of test
 *  accounts is the slow way. Instead, on a dev build, an account that may
 *  manage roles can pick any role and the session is rebuilt as if they
 *  held it: its levels, at their own sites, in every module. The person stays who
 *  they are — audit rows still carry their name — only the role changes.
 *
 *  The gate is `devSignInAllowed()`, the same one that decides whether the
 *  passwordless sign-in exists, and it fails closed: on production the cookie
 *  is ignored entirely, and nothing here is reachable. The second gate is the
 *  real account holding `roles.manage`; a preview can only be started by
 *  someone who could have edited the role anyway. */

export const PREVIEW_COOKIE = "swimly.preview-role";

export function previewAllowed(): boolean {
  return devSignInAllowed();
}

/** The role named by the cookie, if any and if it still exists. */
export async function previewedRole() {
  if (!previewAllowed()) return null;
  const wanted = (await cookies()).get(PREVIEW_COOKIE)?.value;
  if (!wanted) return null;
  // The same role fields a real sign-in reads, so the preview is built from
  // the role's levels exactly as it would be for someone holding it.
  return prisma.staffRole.findUnique({
    where: { id: wanted },
    select: ACCOUNT_SELECT.staffRole.select,
  });
}

/** Whether this (real) account may start a preview. */
export function mayPreview(permissions: readonly string[], isSuperadmin = false): boolean {
  return previewAllowed() && (isSuperadmin || expandPermissions(permissions).has("roles.manage"));
}

/** Every role, for the picker. No permission check of its own: the caller
 *  has already established that the real account may manage roles. */
export async function listRolesForPreview() {
  return prisma.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, description: true },
  });
}
