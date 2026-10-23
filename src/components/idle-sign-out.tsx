"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { IDLE_RENEW_MS, minutesAndSeconds } from "@/lib/idle";

/** The sign-in client, loaded when it is used: this timer sits on every page. */
const auth = () => import("next-auth/react");

/** Shared by every tab of this browser, so working in one keeps the others open. */
const ACTIVITY_KEY = "turnfin.last-activity";
const RENEW_KEY = "turnfin.last-renew";
const EVENTS = ["pointerdown", "pointermove", "keydown", "scroll", "wheel", "touchstart"] as const;

function readTime(key: string): number {
  try { return Number(window.localStorage.getItem(key)) || 0; } catch { return 0; }
}
function writeTime(key: string, value: number) {
  try { window.localStorage.setItem(key, String(value)); } catch { /* private window: this tab alone */ }
}

/** Signs the person out after `minutes` without a click, key, tap or scroll in
 *  any tab, and returns them to `redirectTo`. Activity renews the sign-in on
 *  the server (at most once a minute), which is what keeps it open there.
 *  With `warnMinutes`, a "Still there?" dialog counts down first; while it is
 *  open only its buttons (or activity in another tab) keep the person in;
 *  "Sign out now" goes to `signedOutTo`. */
export function IdleSignOut({ minutes, warnMinutes = 0, redirectTo, signedOutTo = redirectTo }: { minutes: number; warnMinutes?: number; redirectTo: string; signedOutTo?: string }) {
  const [left, setLeft] = React.useState<number | null>(null);
  const stayRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    const idleMs = minutes * 60 * 1000;
    const warnMs = warnMinutes * 60 * 1000;
    let last = Date.now();
    let warning = false;
    let ended = false;
    writeTime(ACTIVITY_KEY, last);

    const end = () => {
      if (ended) return;
      ended = true;
      void auth().then(({ signOut }) => signOut({ redirectTo }));
    };
    // Renewing asks the server for the session, which re-issues the cookie with
    // a fresh expiry; none back means the server has already ended it.
    const renew = (now: number) => {
      if (now - readTime(RENEW_KEY) < IDLE_RENEW_MS) return;
      writeTime(RENEW_KEY, now);
      void auth().then(({ getSession }) => getSession()).then((session) => { if (!session) end(); }).catch(() => {});
    };
    const active = () => {
      const now = Date.now();
      if (now - last < 1000) return;
      last = now;
      writeTime(ACTIVITY_KEY, now);
      renew(now);
    };
    const tick = () => {
      if (ended) return;
      const idle = Date.now() - Math.max(last, readTime(ACTIVITY_KEY));
      if (idle >= idleMs) { end(); return; }
      warning = warnMs > 0 && idle >= idleMs - warnMs;
      setLeft(warning ? idleMs - idle : null);
    };
    const onActivity = () => { if (!warning) active(); };
    stayRef.current = () => { warning = false; active(); tick(); };

    for (const event of EVENTS) window.addEventListener(event, onActivity, { passive: true });
    // A tab back from sleep checks at once rather than on its next tick.
    document.addEventListener("visibilitychange", tick);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      for (const event of EVENTS) window.removeEventListener(event, onActivity);
    };
  }, [minutes, warnMinutes, redirectTo]);

  if (warnMinutes <= 0) return null;
  return (
    <AlertDialog open={left !== null} onOpenChange={(open) => { if (!open) stayRef.current(); }}>
      <AlertDialogContent className="max-h-(--pc-overlay-max-height) overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Still there?</AlertDialogTitle>
          <AlertDialogDescription>
            {`For safety, Turnfin signs you out after ${minutes} minutes without activity. You will be signed out in ${minutesAndSeconds(left ?? 0)}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void auth().then(({ signOut }) => signOut({ redirectTo: signedOutTo }))}>Sign out now</AlertDialogCancel>
          <AlertDialogAction onClick={() => stayRef.current()}>Stay signed in</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
