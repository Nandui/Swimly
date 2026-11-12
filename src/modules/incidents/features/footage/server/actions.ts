"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { requestOrigin } from "@/modules/incidents/shared/origin";
import { IncidentError } from "@/modules/incidents/shared/rules";
import type { FootageRequestInput } from "@/modules/incidents/features/footage/rules";
import { sendFootageRequest } from "@/modules/incidents/features/footage/server/emails";
import { cancelFootageRequest, createFootageRequest, removeFootage, renewFootageRequest } from "@/modules/incidents/features/footage/server/requests";

/** Asking for CCTV footage from the report page. The email
 *  goes after the request is saved; a failed one shows on the request, with
 *  Send again to retry. */

async function guarded(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const result = await run();
    if (result.ok) revalidatePath("/incidents", "layout");
    return result;
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
}

export async function requestFootage(reportId: string, input: FootageRequestInput): Promise<ActionResult> {
  return guarded(async () => {
    const link = await createFootageRequest(await requireIncidentsActor(), reportId, input);
    await sendFootageRequest(link.id, link.token, await requestOrigin());
    return ok();
  });
}

export async function sendFootageRequestAgain(requestId: string): Promise<ActionResult> {
  return guarded(async () => {
    const link = await renewFootageRequest(await requireIncidentsActor(), requestId);
    await sendFootageRequest(link.id, link.token, await requestOrigin());
    return ok();
  });
}

export async function cancelFootage(requestId: string): Promise<ActionResult> {
  return guarded(async () => {
    await cancelFootageRequest(await requireIncidentsActor(), requestId);
    return ok();
  });
}

export async function removeFootageVideo(footageId: string): Promise<ActionResult> {
  return guarded(async () => {
    await removeFootage(await requireIncidentsActor(), footageId);
    return ok();
  });
}
