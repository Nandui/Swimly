import { prisma } from "@/lib/prisma";

/** The passwordless "sign in as the admin" button, and the single question
 *  that decides whether it exists at all.
 *
 *  This is the most dangerous affordance in the app — one click and you are an
 *  admin with no password — so the gate is written to fail closed. It is asked
 *  in three places: the provider is not registered without it, `authorize`
 *  re-asks before handing out an account, and the page does not render the
 *  button. Production never passes it.
 *
 *  `NODE_ENV` alone is not enough here. Vercel builds **previews with
 *  `NODE_ENV=production`** too, so the check that guards the local
 *  `DEV_AUTH_BYPASS` would wrongly refuse on the dev deployment. `VERCEL_ENV`
 *  is the one that distinguishes a preview from production, and it is a system
 *  variable nobody can set by hand on a deployment. */
export function devSignInAllowed(): boolean {
  // On Vercel, production is never eligible whatever else is configured.
  if (process.env.VERCEL_ENV === "production") return false;

  // Any other Vercel deployment — preview, or the development environment.
  if (process.env.VERCEL_ENV) return true;

  // Not on Vercel at all: a local `next dev` may, a production build may not.
  return process.env.NODE_ENV !== "production";
}

/** The account the button signs you in as: the first active admin, which is
 *  the same one `DEV_AUTH_BYPASS` uses locally. A real row, so audit entries
 *  name somebody who exists and permission checks behave exactly as they will
 *  in production. */
export async function getDevAdmin() {
  if (!devSignInAllowed()) return null;

  return prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
}
