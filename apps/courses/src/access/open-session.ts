import { cookies } from "next/headers";
import { db } from "@/data/db";
import { log } from "@/data/log";
import { SESSION_COOKIE, type Account } from "./session";
import { hashToken, newToken, SESSION_HOURS } from "./tokens";

/** Kept while the browser is away at Turnfin, so the pass that comes back can be tied to it. */
export const STATE_COOKIE = process.env.NODE_ENV === "production" ? "__Host-courses-state" : "courses-state";
export const STATE_SECONDS = 300;

export const cookieBase = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" } as const;

/** Sign this person in on this browser: a new session, the count of wrong passwords cleared,
 *  one log row, and the cookie. Call only once it is certain who they are. */
export async function openSession(account: Account, how: "turnfin" | "password"): Promise<void> {
  const now = new Date();
  const token = newToken();
  const expiresAt = new Date(now.getTime() + SESSION_HOURS * 3_600_000);
  const success = { failedSignIns: 0, lockedUntil: null, lastSignInAt: now };
  await db.$transaction(async (tx) => {
    await tx.coursesSignIn.upsert({ where: { userId: account.id }, update: success, create: { userId: account.id, ...success } });
    await tx.coursesSession.create({ data: { userId: account.id, tokenHash: hashToken(token), expiresAt } });
    await log(tx, { orgId: account.orgId, account, action: "person.signed_in", record: "person", recordId: account.id, detail: { how } });
  });
  (await cookies()).set(SESSION_COOKIE, token, { ...cookieBase, expires: expiresAt });
}
