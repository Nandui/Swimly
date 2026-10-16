/** Turnfin Me offline (docs/training.md, e-learning phase 9): lessons finished
 *  and work handed in with no signal reach Turnfin later, with the time they
 *  were done on the phone. Pure and client-safe. */

/** How far back a phone's time is believed. Older work counts from when it arrives. */
export const OFFLINE_DAYS = 14;
/** Phones' clocks drift: a time a little ahead is read as now. */
const AHEAD_MS = 2 * 60_000;

/** The time something was done offline, or null to use the time it arrived:
 *  an ISO time no more than 14 days ago, not before `notBefore` (when the
 *  training was given), and not in the future (a few minutes ahead counts as now). */
export function offlineTime(raw: unknown, notBefore: Date, now: Date = new Date()): Date | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const at = new Date(raw);
  const ms = at.getTime();
  if (!Number.isFinite(ms)) return null;
  if (ms > now.getTime() + AHEAD_MS) return null;
  if (ms < now.getTime() - OFFLINE_DAYS * 86_400_000 || ms < notBefore.getTime()) return null;
  return ms > now.getTime() ? now : at;
}

/** "16 Oct, 10:42" in Irish time, for audit summaries. */
export const offlineLabel = (at: Date) => new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
