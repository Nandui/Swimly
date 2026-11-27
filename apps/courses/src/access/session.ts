import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/data/db";
import { grantsOf, may, type Access, type Grant } from "./grants";
import { hashToken, sessionLive } from "./tokens";

/** The signed-in account, as the rest of the app sees it. Never the password hash. */
export type Account = {
  id: string;
  orgId: string;
  name: string;
  email: string;
  /** The Turnfin person record the course tables name as instructor or marker, if any. */
  personId: string | null;
  access: Access;
};

/** `__Host-` pins the cookie to this host over HTTPS: Turnfin's own cookie on turnfin.app is
 *  never sent here, and this one is never sent there. Plain HTTP on localhost cannot hold it. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-courses" : "courses";

/** How often a live session's "last seen" is written, at most. */
const TOUCH_MS = 60_000;

/** Who is signed in on this request, or null. Read from the database every time, so
 *  deactivating an account or changing its grants takes effect at once. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.coursesSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true, expiresAt: true, lastSeenAt: true,
      account: { select: { id: true, orgId: true, name: true, email: true, personId: true, siteIds: true, grants: true, isActive: true } },
    },
  });
  const now = new Date();
  if (!session || !session.account.isActive || !sessionLive(session, now)) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_MS) {
    await db.coursesSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  const { account } = session;
  return {
    id: account.id, orgId: account.orgId, name: account.name, email: account.email, personId: account.personId,
    access: { grants: grantsOf(account.grants), siteIds: account.siteIds },
  };
});

/** For a page or action anyone signed in may use. Sends everyone else to sign in. */
export async function requireAccount(): Promise<Account> {
  return (await currentAccount()) ?? redirect("/sign-in");
}

/** For a page or action that needs a grant, and at a site when one is given. Without it the
 *  page does not exist, as far as that account can tell. */
export async function requireGrant(grant: Grant, siteId?: string): Promise<Account> {
  const account = await requireAccount();
  if (!may(account.access, grant, siteId)) notFound();
  return account;
}
