import { revalidatePath } from "next/cache";
import { addCourseFile, MAX_FILE_BYTES, TrainingFileError } from "@/modules/training/features/builder";

/** Adds an image or PDF to a course. Same-origin only; the
 *  body is read as a stream and refused past the size cap. */
export async function POST(request: Request) {
  try {
    const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Add files from Turnfin." }, { status: 403 });
    const reader = request.body?.getReader();
    if (!reader) throw new TrainingFileError("Choose a file.");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES + 128 * 1024) { await reader.cancel(); return Response.json({ ok: false, error: "Files must be no larger than 4 MB." }, { status: 413 }); }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("file"), courseId = String(form.get("courseId") ?? "");
    if (!(file instanceof File)) throw new TrainingFileError("Choose a file.");
    const row = await addCourseFile(courseId, file);
    revalidatePath(`/training/courses/${courseId}`);
    return Response.json({ ok: true, file: row });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof TrainingFileError ? error.message : "Could not add the file. Try again." }, { status: 400 });
  }
}
