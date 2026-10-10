"use server";

import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { areaNamesAt } from "@/lib/directory";

/** The working site's areas, for a class's or an assessment's "where" (Admin keeps the list).
 *  Names only, for anyone signed in: the form that asks has checked its own permission. */
export async function workingSiteAreas(): Promise<string[]> {
  await requireSession();
  return areaNamesAt(await currentClubId());
}
