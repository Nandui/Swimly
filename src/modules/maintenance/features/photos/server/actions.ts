"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requireMaintenanceActor } from "@/modules/maintenance/shared/access";
import { MaintenanceError } from "@/modules/maintenance/shared/rules";
import { removePhoto } from "@/modules/maintenance/features/photos/server/photos";

/** Removing a photo from a request. Adding one goes through /api/maintenance/photos, which reads
 *  the upload as a stream with a size cap. */
export async function removeMaintenancePhoto(photoId: string): Promise<ActionResult> {
  try {
    await removePhoto(await requireMaintenanceActor(), photoId);
  } catch (error) {
    if (error instanceof MaintenanceError) return fail(error.message);
    throw error;
  }
  revalidatePath("/maintenance", "layout");
  return ok();
}
