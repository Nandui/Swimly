import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Files used in lessons (docs/training.md): images in the text and the PDF or
 *  image of a File lesson. Kept in the database like incident photos, under
 *  Vercel's 4.5 MB request limit. Checked by their first bytes, not the name. */

export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const FILE_FORMATS = "Use a PDF, a photo (JPEG, PNG or WebP) or a recording (MP3, M4A, OGG or WAV), up to 4 MB.";

/** Browsers name some recordings differently; this is the type a file is stored with. */
export const storedMime = (type: string) => ({ "audio/mp3": "audio/mpeg", "audio/x-m4a": "audio/mp4", "audio/m4a": "audio/mp4", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav" })[type] ?? type;

export function fileProblem(file: { name: string; type: string; size: number }, bytes: Buffer): string | null {
  const formats = {
    "application/pdf": { extension: /\.pdf$/i, valid: bytes.subarray(0, 5).toString() === "%PDF-" },
    "image/jpeg": { extension: /\.jpe?g$/i, valid: bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 },
    "image/png": { extension: /\.png$/i, valid: bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
    "image/webp": { extension: /\.webp$/i, valid: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" },
    // Recordings for Audio lessons (phase 3).
    "audio/mpeg": { extension: /\.mp3$/i, valid: bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0) },
    "audio/mp4": { extension: /\.(m4a|mp4)$/i, valid: bytes.subarray(4, 8).toString() === "ftyp" },
    "audio/ogg": { extension: /\.(ogg|oga|opus)$/i, valid: bytes.subarray(0, 4).toString() === "OggS" },
    "audio/wav": { extension: /\.wav$/i, valid: bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WAVE" },
  };
  const format = formats[storedMime(file.type) as keyof typeof formats];
  if (!format || !format.valid || !format.extension.test(file.name) || file.size !== bytes.length || !bytes.length || bytes.length > MAX_FILE_BYTES) return FILE_FORMATS;
  return null;
}

export const safeFileName = (name: string) => name.replace(/[\x00-\x1f/\\"]/g, "_").slice(0, 200) || "file";

/** How a stored file is sent: images and PDFs open in place, never cached,
 *  and nothing in them can run. */
export function fileResponse(file: { bytes: Uint8Array; mime: string; name: string; size: number }) {
  return new Response(new Uint8Array(file.bytes), { headers: {
    "Content-Type": file.mime, "Content-Length": String(file.size),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox",
  } });
}

export const FILE_SELECT = { id: true, name: true, mime: true, size: true, bytes: true } as const satisfies Prisma.TrainingFileSelect;
