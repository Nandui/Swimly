import { appRoute } from "@/lib/apps/switches";
import { revalidatePath } from "next/cache";
import { addFile, IncidentError, MAX_FILE_BYTES, requireIncidentsActor } from "@/modules/incidents/features/files";

/** Adds a photo or document to a report. Same-origin only;
 *  the body is read as a stream and refused past the size cap. */
async function servePost(request: Request) {
  try {
    const who = await requireIncidentsActor();
    const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Add files from the staff app." }, { status: 403 });
    const reader = request.body?.getReader();
    if (!reader) throw new IncidentError("Choose a file.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES + 128 * 1024) { await reader.cancel(); return Response.json({ ok: false, error: "Files must be no larger than 4 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new IncidentError("Choose a file.");
    await addFile(who, String(form.get("reportId")), file);
    revalidatePath("/incidents", "layout");
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof IncidentError ? error.message : "Could not add the file. Try again." }, { status: 400 });
  }
}

export const POST = appRoute("incidents", servePost);
