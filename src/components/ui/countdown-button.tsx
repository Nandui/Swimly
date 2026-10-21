"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { Loader2, Timer } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";

/** How long a move or enrolment's confirm button waits (owner request, 21 October 2026). */
export const CONFIRM_WAIT_SECONDS = 5;

/** Seconds left before a held confirm button may be pressed. Starts again whenever `key`
 *  changes (the details being confirmed changed); a null key holds nothing and returns 0. */
export function useCountdown(key: string | null, seconds = CONFIRM_WAIT_SECONDS): number {
  const [left, setLeft] = useState(seconds);
  const [counted, setCounted] = useState(key);
  // A new key restarts the wait in the same render, so the old figure never shows.
  if (counted !== key) {
    setCounted(key);
    setLeft(seconds);
  }
  useEffect(() => {
    if (key === null) return;
    // At 0 the update is the same value, so React skips the render.
    const timer = setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [key]);
  return key === null ? 0 : left;
}

/** A confirm button held for a few seconds: "Confirm in 5", then "Confirm". While it waits it
 *  stays focusable (aria-disabled plus a click guard, which also stops Enter submitting the form)
 *  so a keyboard user can rest on it; a polite live region says when it will be ready and again
 *  when it is. Cancel beside it is never held. */
export function CountdownButton({ left, pending = false, pendingLabel = "Saving…", announce = true, children, onClick, className, ...props }:
  Omit<ComponentProps<typeof Button>, "asChild" | "children"> & {
    /** From useCountdown. */
    left: number;
    pending?: boolean;
    pendingLabel?: string;
    /** False on all but one of several held buttons, so the wait is announced once. */
    announce?: boolean;
    /** The label once ready, e.g. "Confirm move". */
    children: string;
  }) {
  const held = left > 0 || pending;
  return <>
    <Button {...props} aria-disabled={held || undefined} aria-busy={pending || undefined}
      className={cn("tabular-nums aria-disabled:cursor-not-allowed aria-disabled:opacity-60", className)}
      onClick={(event) => { if (held) { event.preventDefault(); return; } onClick?.(event); }}>
      {pending ? <><Loader2 aria-hidden="true" className="animate-spin" />{pendingLabel}</>
        : left > 0 ? <><Timer aria-hidden="true" />{children} in {left}</>
          : children}
    </Button>
    {announce ? <span aria-live="polite" aria-atomic="true" className="sr-only">
      {pending ? pendingLabel : left > 0 ? `Check the change. ${children} will be ready in a few seconds.` : `${children} is ready.`}
    </span> : null}
  </>;
}
