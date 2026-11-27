import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/data/db";
import { grantsFor, may, type Access, type Grant } from "./grants";
import { hashToken, sessionLive } from "./tokens";

/** The signed-in person, as the rest of the app sees them: their Turnfin account
 *  (docs/courses.md, Sign-in and access). Never the password hash. */
export type Account = {
  /** The person's id in Turnfin (`users.id`): what the course tables record as instructor or marker. */
  id: string;
  orgId: string;
  name: string;
  email: string;
  access: Access;
};

/** What is read of a person to decide who they are and what they may do. */
export const PERSON = {
  id: true, orgId: true, name: true, email: true, isActive: true, isSuperadmin: true, siteIds: true,
  staffRole: { select: { levels: true, extras: true } },
} as const;

type Person = {
  id: string; orgId: string | null; name: string; email: string; isActive: boolean; isSuperadmin: boolean; siteIds: string[];
  staffRole: { levels: unknown; extras: string[] } | null;
};

/** A person as an account, or null when they cannot use Courses at all: deactivated, or
 *  belonging to no organisation. Holding no grant is not a refusal: they sign in and are told. */
export function accountOf(person: Person): Account | null {
  if (!person.isActive || !person.orgId) return null;
  const grants = grantsFor({ isSuperadmin: person.isSuperadmin, levels: person.staffRole?.levels ?? null, extras: person.staffRole?.extras ?? [] });
  return { id: person.id, orgId: person.orgId, name: person.name, email: person.email, access: { grants, siteIds: person.siteIds } };
}

/** `__Host-` pins the cookie to this host over HTTPS: Turnfin's own cookie on turnfin.app is
 *  never sent here, and this one is never sent there. Plain HTTP on localhost cannot hold it. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-courses" : "courses";

/** How often a live session's "last seen" is written, at most. */
const TOUCH_MS = 60_000;

/** Who is signed in on this request, or null. The person and their role are read from the
 *  database every time, so deactivating someone or changing their role in Turnfin takes
 *  effect here at once. */
export const currentAccount = cache(async (): Promise<Account | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.coursesSession.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, lastSeenAt: true },
  });
  const now = new Date();
  if (!session || !sessionLive(session, now)) return null;
  const person = await db.user.findUnique({ where: { id: session.userId }, select: PERSON });
  const account = person && accountOf(person);
  if (!account) return null;
  if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_MS) {
    await db.coursesSession.update({ where: { id: session.id }, data: { lastSeenAt: now } });
  }
  return account;
});

/** For a page or action anyone signed in may use. Sends everyone else to sign in. */
export async function requireAccount(): Promise<Account> {
  return (await currentAccount()) ?? redirect("/sign-in");
}

/** For a page or action that needs a grant, and at a site when one is given. Without it the
 *  page does not exist, as far as that person can tell. */
export async function requireGrant(grant: Grant, siteId?: string): Promise<Account> {
  const account = await requireAccount();
  if (!may(account.access, grant, siteId)) notFound();
  return account;
}
