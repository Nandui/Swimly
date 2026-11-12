import "server-only";
// A composition root, like `src/modules/server.ts`: the one place that knows
// which modules need work done at the start of a signed-in request. Core's
// `requireSession` loads it lazily and never imports a module itself.
import { processScheduledUnenrolments } from "@/modules/activities";
import { appOn } from "@/lib/apps/switches";

/** Runs once per signed-in request, before any read or capacity check.
 *  Aquatics applies previously authorised, now-due unenrolments so rosters
 *  and places are current; it needs no external timer. Not while the swim school is
 *  switched off: the next request after it is switched back on applies them. */
export async function runSessionHooks() {
  if (await appOn("swim-school")) await processScheduledUnenrolments();
}
