"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { requestOrigin } from "@/modules/incidents/shared/origin";
import { IncidentError } from "@/modules/incidents/shared/rules";
import type { WellbeingRequestInput, WellbeingUpdateInput } from "@/modules/incidents/features/wellbeing/rules";
import { sendWellbeingRequest, sendWellbeingUpdated } from "@/modules/incidents/features/wellbeing/server/emails";
import { recordWellbeingUpdate } from "@/modules/incidents/features/wellbeing/server/hr-link";
import { cancelWellbeingCheck, createWellbeingCheck, renewWellbeingCheck } from "@/modules/incidents/features/wellbeing/server/requests";
import { saveWellbeingRecipients } from "@/modules/incidents/features/wellbeing/server/settings";

/** Asking HR (wellbeing checks, or a staff member in an incident) from the report page, HR's link and Settings
 *  (docs/incidents.md). The email to HR goes after the request is saved; a
 *  failed one shows on the request, with Send again to retry. */

async function guarded(run: () => Promise<ActionResult>, path = "/incidents"): Promise<ActionResult> {
  try {
    const result = await run();
    if (result.ok) revalidatePath(path, "layout");
    return result;
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
}

export async function requestWellbeingCheck(reportId: string, input: WellbeingRequestInput): Promise<ActionResult> {
  return guarded(async () => {
    const link = await createWellbeingCheck(await requireIncidentsActor(), reportId, input);
    await sendWellbeingRequest(link.id, link.token, await requestOrigin());
    return ok();
  });
}

export async function sendWellbeingCheckAgain(checkId: string): Promise<ActionResult> {
  return guarded(async () => {
    const link = await renewWellbeingCheck(await requireIncidentsActor(), checkId);
    await sendWellbeingRequest(link.id, link.token, await requestOrigin());
    return ok();
  });
}

export async function cancelWellbeing(checkId: string): Promise<ActionResult> {
  return guarded(async () => {
    await cancelWellbeingCheck(await requireIncidentsActor(), checkId);
    return ok();
  });
}

export async function saveWellbeingSettings(addresses: string, copies: string, bySite: Record<string, string>): Promise<ActionResult> {
  return guarded(async () => {
    await saveWellbeingRecipients(await requireIncidentsActor(), addresses, copies, bySite);
    return ok();
  });
}

/** From HR's link, with no sign-in: the link's secret is the only key. */
export async function recordWellbeing(input: WellbeingUpdateInput): Promise<ActionResult> {
  return guarded(async () => {
    const done = await recordWellbeingUpdate(input);
    const origin = await requestOrigin();
    after(() => sendWellbeingUpdated(done.checkId, input.finished, origin));
    return ok();
  }, "/wellbeing");
}
