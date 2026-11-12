"use server";

import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { areaLanesAt } from "@/lib/directory";

/** The working site's areas and how many lanes each has, for a class's or an assessment's "where"
 *  (Admin keeps the list). For anyone signed in: the form that asks has checked its own permission. */
export async function workingSiteAreas(): Promise<{ name: string; lanes: number }[]> {
  await requireSession();
  return areaLanesAt(await currentClubId());
}
