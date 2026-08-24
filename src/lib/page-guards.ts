import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManage, isAdmin } from "@/lib/authz";

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

export async function managePage() {
  const session = await pageSession();
  if (!canManage(session.user.role)) notFound();
  return session;
}

export async function adminPage() {
  const session = await pageSession();
  if (!isAdmin(session.user.role)) notFound();
  return session;
}
