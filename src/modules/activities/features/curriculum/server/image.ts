/** Shared by the image picker and server validation. */
export const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export type ImageKind = "programme" | "level";

export function curriculumImageUrl(kind: ImageKind, id: string, version?: string | null) {
  return version ? `/api/curriculum-images/${kind}/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}` : undefined;
}
