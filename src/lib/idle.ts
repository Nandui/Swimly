/** Signing out after a time without activity: everyone, on every device (owner
 *  decision, 23 October 2026). Readable from client components too.
 *
 *  The screen (src/components/idle-sign-out.tsx) warns first and signs out on
 *  the minute. The server is the backstop: the sign-in cookie lasts only a
 *  little longer than that and is renewed while the person is active, so a tab
 *  closed or asleep cannot keep a session open. Shared work devices keep their
 *  shorter timer (src/lib/devices/constants.ts). */
export const IDLE_SIGN_OUT_MINUTES = 30;
/** How long before the sign-out the "Still there?" warning appears. */
export const IDLE_WARNING_MINUTES = 2;
/** The screen renews the sign-in at most this often while someone is active. */
export const IDLE_RENEW_MS = 60 * 1000;
/** The sign-in cookie's lifetime, renewed on activity: the idle limit, plus two
 *  renewals' grace so the server never ends a session the screen still shows. */
export const SESSION_MAX_AGE_SECONDS = IDLE_SIGN_OUT_MINUTES * 60 + 2 * (IDLE_RENEW_MS / 1000);

/** Where a person signed out for inactivity lands, and the note it shows. */
export const IDLE_SIGNED_OUT_REASON = "idle";
export const IDLE_SIGNED_OUT_TEXT = `You were signed out after ${IDLE_SIGN_OUT_MINUTES} minutes without activity. Sign in again to carry on.`;

/** True for a sign-in that would outlive the idle limit: one made before the
 *  limit existed, which lasted 30 days. It reads as signed out, once. */
export function outlivesIdleLimit(expiresAtMs: number | null | undefined, now = Date.now()): boolean {
  return typeof expiresAtMs === "number" && expiresAtMs - now > SESSION_MAX_AGE_SECONDS * 1000 + 60 * 1000;
}

/** "1:45" for a countdown. */
export function minutesAndSeconds(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
