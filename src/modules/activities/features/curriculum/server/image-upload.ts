import { squarePicture } from "@/lib/images/square-picture";

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
  const picture = await squarePicture(file);
  return picture.ok ? { ok: true, data: { imageData: picture.bytes, imageVersion: picture.version } } : picture;
}
