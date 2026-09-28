import { createHash } from "node:crypto";
import sharp from "sharp";
import { IMAGE_MAX_BYTES } from "./image";

type ImageData = { imageData: Uint8Array<ArrayBuffer> | null; imageVersion: string | null };

/** Run only after permission and ownership checks. No storage side effect: the
 * returned bytes join the record's existing transaction and audit entry. */
export async function prepareImage(form?: FormData): Promise<
  { ok: true; data: Partial<ImageData> } | { ok: false; error: string }
> {
  if (!form) return { ok: true, data: {} };
  if (!(form instanceof FormData)) return { ok: false, error: "Choose the image again." };
  const file = form.get("image");
  const remove = form.get("removeImage") === "true";
  if (file !== null && !(file instanceof File)) return { ok: false, error: "Choose a JPG, PNG or WebP image." };
  if (remove && file instanceof File && file.size) return { ok: false, error: "Choose an image or remove it, then save again." };
  if (remove) return { ok: true, data: { imageData: null, imageVersion: null } };
  if (!file || (file.size === 0 && !file.name)) return { ok: true, data: {} };
  if (file.size === 0) return { ok: false, error: "That image is empty. Choose another file." };
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: "Choose an image under 2 MB." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Choose a JPG, PNG or WebP image." };
  }
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
    // Contain artwork in a square so Thumbnail's cover fit cannot crop a badge.
    // Sharp strips embedded metadata by default.
    const output = await pipeline.rotate().resize(512, 512, {
      fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 },
    }).webp({ quality: 85 }).toBuffer();
    if (output.length > 262144) return { ok: false, error: "This image is too detailed. Choose a simpler or smaller image." };
    return { ok: true, data: { imageData: new Uint8Array(output), imageVersion: createHash("sha256").update(output).digest("hex") } };
  } catch {
    return { ok: false, error: "This image could not be read. Choose a JPG, PNG or WebP under 2 MB and 16 megapixels." };
  }
}
