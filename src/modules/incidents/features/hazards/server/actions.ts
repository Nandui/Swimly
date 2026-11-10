"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { announce, type AssessedHazard } from "@/modules/contributions";
import { findHazards, linkHazards, unlinkHazard, type LinkInput } from "@/modules/incidents/features/hazards/server/links";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { IncidentError } from "@/modules/incidents/shared/rules";

/** Linking the site's assessed hazards to a report, from the report page. */

async function guarded(run: () => Promise<void>): Promise<ActionResult> {
  try {
    await run();
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
  revalidatePath("/incidents", "layout");
  return ok();
}

/** A read the dialog calls as the person types, so the site's whole list never goes to the
 *  browser. It authorizes like the write: triage at the report's site. */
export async function searchReportHazards(reportId: string, q: string): Promise<AssessedHazard[]> {
  try {
    return await findHazards(await requireIncidentsActor(), reportId, typeof q === "string" ? q : "");
  } catch (error) {
    if (error instanceof IncidentError) return [];
    throw error;
  }
}

/** Link hazards and, when asked, announce it once the links are saved: Risk assessments then
 *  raises a review request on each assessment. */
export async function linkReportHazards(reportId: string, input: LinkInput): Promise<ActionResult> {
  return guarded(async () => {
    const flagged = await linkHazards(await requireIncidentsActor(), reportId, input);
    if (flagged) await announce("incidents.hazards.flagged", flagged);
  });
}

export async function unlinkReportHazard(linkId: string): Promise<ActionResult> {
  return guarded(async () => unlinkHazard(await requireIncidentsActor(), linkId));
}
