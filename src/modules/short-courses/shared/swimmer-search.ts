"use server";

import { AuthorizationError, requireSession } from "@/lib/authz";
import { holdsAnywhere } from "@/lib/policy/engine";
import { actorForSession } from "@/lib/policy/session";
import { members, type MemberHit } from "@/modules/contributions";

/** The swimmer search behind "Find the swimmer" in the booking dialogs (owner request, 21 October
 *  2026), called while the desk types. Anyone who books people on short courses or Academy courses
 *  may search; a hit carries only what tells two people apart (name, member number, date of birth,
 *  contact's name). Nothing comes back when the swim school is switched off. */
export async function findSwimmers(q: string): Promise<MemberHit[]> {
  const actor = actorForSession(await requireSession());
  if (!holdsAnywhere(actor, "short-courses.read") && !holdsAnywhere(actor, "academy.read")) throw new AuthorizationError("Short courses or Academy access is required.");
  const directory = await members();
  return directory ? directory.search(String(q ?? "").slice(0, 80)) : [];
}
