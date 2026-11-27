import { createHash, randomBytes } from "node:crypto";

/** Session tokens and the rules around them. Pure: no database, no cookies. */

/** A signed-in browser stays signed in this long at most. */
export const SESSION_HOURS = 12;
/** Desk computers and tablets are shared: a session unused this long is over. */
export const IDLE_MINUTES = 30;
/** Wrong passwords in a row before sign-in is locked, and for how long. */
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;

/** A new random token for the cookie. Only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Is this session still good at `now`? */
export function sessionLive(session: { expiresAt: Date; lastSeenAt: Date }, now: Date): boolean {
  if (session.expiresAt <= now) return false;
  return now.getTime() - session.lastSeenAt.getTime() < IDLE_MINUTES * 60_000;
}

/** What a wrong password does to the count, and whether it locks sign-in. */
export function afterFailure(failures: number, now: Date): { failedSignIns: number; lockedUntil: Date | null } {
  const failedSignIns = failures + 1;
  return {
    failedSignIns,
    lockedUntil: failedSignIns >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
  };
}

/** Emails are stored and compared in lower case, without surrounding spaces. */
export function cleanEmail(value: string): string {
  return value.trim().toLowerCase();
}
