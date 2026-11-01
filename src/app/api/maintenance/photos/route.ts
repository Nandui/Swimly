import { appRoute } from "@/lib/apps/switches";
import { readUploadForm, sizeLimit } from "@/lib/files";
import { revalidatePath } from "next/cache";
import { addPhoto, MAX_PHOTO_BYTES, MaintenanceError, requireMaintenanceActor } from "@/modules/maintenance/features/photos";

/** Adds a photo to a request. Same-origin only; the body is read as a stream and refused past the
 *  size cap. */
async function servePost(request: Request) {
  try {
    const who = await requireMaintenanceActor();
    const read = await readUploadForm(request, MAX_PHOTO_BYTES);
    if (!read.ok) return Response.json({ ok: false, error: read.status === 403 ? "Add photos from the staff app." : `Photos must be no larger than ${sizeLimit(MAX_PHOTO_BYTES)}.` }, { status: read.status });
    const file = read.form.get("file");
    if (!(file instanceof File)) throw new MaintenanceError("Choose a photo.");
    await addPhoto(who, String(read.form.get("requestId")), file);
    revalidatePath("/maintenance", "layout");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof MaintenanceError ? error.message : "Could not add the photo. Try again." }, { status: 400 });
  }
}

export const POST = appRoute("maintenance", servePost);
