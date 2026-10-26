/** The platform's one file check (docs/architecture.md, Platform services; D14). An upload is
 *  what its first bytes say it is, never what its name or the browser claims, and is refused in
 *  one plain sentence. The app decides which kinds it takes and how big, and keeps the bytes in
 *  its own tables. Maintenance's photos use it first; the other apps move onto it in roadmap
 *  step 4. Pure: no database, no storage. */

export type FileKind = "photo" | "pdf";

type Format = { kind: FileKind; extension: RegExp; matches(bytes: Uint8Array): boolean };
const startsWith = (bytes: Uint8Array, prefix: readonly number[], at = 0) => prefix.every((b, i) => bytes[at + i] === b);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** Each type an upload may be, by its declared MIME type. */
const FORMATS: Record<string, Format> = {
  "image/jpeg": { kind: "photo", extension: /\.jpe?g$/i, matches: (b) => startsWith(b, [255, 216, 255]) },
  "image/png": { kind: "photo", extension: /\.png$/i, matches: (b) => startsWith(b, [137, 80, 78, 71, 13, 10, 26, 10]) },
  "image/webp": { kind: "photo", extension: /\.webp$/i, matches: (b) => startsWith(b, ascii("RIFF")) && startsWith(b, ascii("WEBP"), 8) },
  "application/pdf": { kind: "pdf", extension: /\.pdf$/i, matches: (b) => startsWith(b, ascii("%PDF-")) },
};

/** The MIME types a kind takes, for a file picker's `accept`. */
export const acceptFor = (kinds: readonly FileKind[]) => Object.entries(FORMATS).filter(([, f]) => kinds.includes(f.kind)).map(([type]) => type).join(",");

/** "8 MB", for limits in messages. */
export const sizeLimit = (maxBytes: number) => `${Math.round(maxBytes / (1024 * 1024))} MB`;

/** What the person may send, in words: "a photo (JPEG, PNG or WebP)", "a photo (JPEG, PNG or WebP) or a PDF". */
function allowed(kinds: readonly FileKind[]) {
  return kinds.map((k) => (k === "photo" ? "a photo (JPEG, PNG or WebP)" : "a PDF")).join(" or ");
}

/** Why this upload is refused, in one sentence, or null when it is what it says. `bytes` are the
 *  whole file: its first bytes must match its declared type and name, and its length the size. */
export function fileProblem(file: { name: string; type: string; size: number }, bytes: Uint8Array, rule: { kinds: readonly FileKind[]; maxBytes: number }): string | null {
  const format = FORMATS[file.type];
  const fits = bytes.length > 0 && bytes.length <= rule.maxBytes && file.size === bytes.length;
  if (format && rule.kinds.includes(format.kind) && format.matches(bytes) && format.extension.test(file.name) && fits) return null;
  return `Use ${allowed(rule.kinds)}, up to ${sizeLimit(rule.maxBytes)}.`;
}

/** A file name safe to store and to send back in a header: no control characters or path
 *  separators, at most 200 characters. */
export const safeFileName = (name: string) => name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 200) || "file";

/** A same-origin multipart upload read as a stream and cut off past `maxBytes` (plus room for the
 *  form's other fields), so an oversized body is never held whole. When it came from another
 *  site or ran over the limit, the status the route answers with (403 or 413). */
export async function readUploadForm(request: Request, maxBytes: number): Promise<{ ok: true; form: FormData } | { ok: false; status: 403 | 413 }> {
  const origin = request.headers.get("origin"), host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!origin || new URL(origin).host !== host) return { ok: false, status: 403 };
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes + 128 * 1024) { await reader.cancel(); return { ok: false, status: 413 }; }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) { body.set(chunk, at); at += chunk.length; }
  const form = await new Response(body, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
  return { ok: true, form };
}
