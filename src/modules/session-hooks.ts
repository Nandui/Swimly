import "server-only";
// A composition root, like `src/modules/server.ts`: the one place that knows
// which modules need work done at the start of a signed-in request. Core's
// `requireSession` loads it lazily and never imports a module itself.
import { processScheduledUnenrolments } from "./aquatics/lib/enrolment/scheduled";

/** Runs once per signed-in request, before any read or capacity check.
 *  Aquatics applies previously authorised, now-due unenrolments so rosters
 *  and places are current; it needs no external timer. */
export async function runSessionHooks() {
  await processScheduledUnenrolments();
}
