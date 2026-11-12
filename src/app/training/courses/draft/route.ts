import { draftCourse, MAX_DOCUMENT_BYTES } from "@/modules/training/features/ai-draft";

/** Drafts a course from a document with AI (AI drafting).
 *  Same-origin only; the body is read as a stream and refused past the size
 *  cap. Writing a course can take a minute or two. */
export const maxDuration = 300;

export async function POST(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return Response.json({ ok: false, error: "Draft courses from Turnfin." }, { status: 403 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ ok: false, error: "Choose a document or paste its text." }, { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_DOCUMENT_BYTES + 512 * 1024) { await reader.cancel(); return Response.json({ ok: false, error: "Documents must be no larger than 4 MB." }, { status: 413 }); }
    chunks.push(value);
  }
  const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData().catch(() => null);
  if (!form) return Response.json({ ok: false, error: "Choose a document or paste its text." }, { status: 400 });
  const file = form.get("document");
  const result = await draftCourse(
    { file: file instanceof File ? file : null, text: String(form.get("text") ?? "") },
    { title: String(form.get("title") ?? ""), exam: form.get("exam") === "on", practice: form.get("practice") === "on" },
  ).catch(() => ({ ok: false as const, error: "Building courses needs the Author level in Training." }));
  return Response.json(result, { status: result.ok ? 200 : 400 });
}
