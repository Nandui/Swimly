"use client";

import { useSyncExternalStore } from "react";
import { session } from "@/lib/api";

let cached: { token: string; email: string } | null = null;
let key = "";
/** Same object while the session is the same, as useSyncExternalStore needs. */
function snapshot() {
  const now = session.get();
  const next = now ? `${now.email}:${now.token}` : "";
  if (next !== key) { key = next; cached = now; }
  return cached;
}

/** The signed-in email on this browser, or null; undefined until the page has loaded in the
 *  browser (the server never knows). */
export function useSession() {
  return useSyncExternalStore(session.subscribe, snapshot, () => undefined);
}
