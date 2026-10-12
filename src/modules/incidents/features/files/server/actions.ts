"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireIncidentsActor } from "@/modules/incidents/shared/access";
import { IncidentError } from "@/modules/incidents/shared/rules";
import { removeFile } from "@/modules/incidents/features/files/server/files";

/** Removing a file from a report. Adding one goes through /api/incidents/files,
 *  which reads the upload as a stream with a size cap. */
export async function removeIncidentFile(fileId: string): Promise<ActionResult> {
  try {
    await removeFile(await requireIncidentsActor(), fileId);
  } catch (error) {
    if (error instanceof IncidentError) return fail(error.message);
    throw error;
  }
  revalidatePath("/incidents", "layout");
  return ok();
}
