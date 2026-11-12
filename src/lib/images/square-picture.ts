import { createHash } from "node:crypto";
import sharp from "sharp";
import { PICTURE_MAX_BYTES, PICTURE_TYPES } from "@/lib/images/picture-rules";

/** Small square pictures kept in the database beside their record (the swim school's
 *  programme and level artwork, a supplier's logo): checked, shrunk to 512px WebP and
 *  stripped of camera details. Run only after the caller's permission check. */

export type SquarePicture = { ok: true; bytes: Uint8Array<ArrayBuffer>; version: string } | { ok: false; error: string };

/** `solid` puts the picture on a white square, so a dark logo with a see-through
 *  background still shows in dark mode; otherwise the padding stays see-through. */
export async function squarePicture(file: File, { solid = false }: { solid?: boolean } = {}): Promise<SquarePicture> {
  if (file.size === 0) return { ok: false, error: "That image is empty. Choose another file." };
  if (file.size > PICTURE_MAX_BYTES) return { ok: false, error: "Choose an image under 2 MB." };
  if (!PICTURE_TYPES.includes(file.type)) return { ok: false, error: "Choose a JPG, PNG or WebP image." };
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // Inspect magic bytes before invoking a decoder: never parse SVG or other
    // document types just because the browser labelled them as an image.
    const format = input.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ? "jpeg"
      : input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? "png"
      : input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP" ? "webp" : null;
    if (!format) return { ok: false, error: "That file is not a valid JPG, PNG or WebP image." };
    const pipeline = sharp(input, { limitInputPixels: 16000000, failOn: "warning" });
    const metadata = await pipeline.metadata();
    if ((metadata.pages ?? 1) > 1) return { ok: false, error: "Choose a still image rather than an animation." };
    // Contain the picture in a square so a cover fit cannot crop a badge or a logo.
    // Sharp strips embedded metadata by default.
    const square = pipeline.rotate().resize(512, 512, {
      fit: "contain", background: solid ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: 0, g: 0, b: 0, alpha: 0 },
    });
    const output = await (solid ? square.flatten({ background: { r: 255, g: 255, b: 255 } }) : square).webp({ quality: 85 }).toBuffer();
    if (output.length > 262144) return { ok: false, error: "This image is too detailed. Choose a simpler or smaller image." };
    return { ok: true, bytes: new Uint8Array(output), version: createHash("sha256").update(output).digest("hex") };
  } catch {
    return { ok: false, error: "This image could not be read. Choose a JPG, PNG or WebP under 2 MB and 16 megapixels." };
  }
}
