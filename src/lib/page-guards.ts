import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { can, canAny, type PermissionKey } from "@/lib/authz";

/** Page-level guards, kept apart from `authz.ts` because they answer a
 *  different question with a different verb.
 *
 *  An action *refuses* — it throws, because being called without permission
 *  should not have been possible. A page *declines to exist*: the nav never
 *  offered the route, so 404 is a truer answer than an error screen, and it
 *  does not confirm that the page is there to someone guessing URLs.
 *
 *  This is the second of the three guards. It hides the button; the action is
 *  the one doing the securing. */

export async function pageSession() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  return session;
}

/** The page exists only for someone holding this permission. */
export async function permissionPage(permission: PermissionKey) {
  const session = await pageSession();
  if (!can(session, permission)) notFound();
  return session;
}

/** The page exists for anyone holding at least one of these — for screens that
 *  serve several permissions at once. */
export async function anyPermissionPage(...permissions: PermissionKey[]) {
  const session = await pageSession();
  if (!canAny(session, ...permissions)) notFound();
  return session;
}
