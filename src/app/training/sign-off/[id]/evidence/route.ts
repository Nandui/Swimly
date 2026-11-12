import { revalidatePath } from "next/cache";
import { addEvidence, EvidenceError, MAX_FILE_BYTES } from "@/modules/training/features/sign-off";

/** Adds a photo as evidence to a practical waiting for sign-off (e-learning
 *  phase 5). Same-origin only; the body is read as a stream and refused past the size cap. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Add photos from Turnfin." }, { status: 403 });
    const reader = request.body?.getReader();
    if (!reader) throw new EvidenceError("Choose a photo.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES + 128 * 1024) { await reader.cancel(); return Response.json({ ok: false, error: "Photos must be no larger than 4 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new EvidenceError("Choose a photo.");
    const row = await addEvidence(id, file);
    revalidatePath(`/training/sign-off/${id}`);
    return Response.json({ ok: true, evidence: row });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof EvidenceError ? error.message : "Could not add the photo. Try again." }, { status: 400 });
  }
}
