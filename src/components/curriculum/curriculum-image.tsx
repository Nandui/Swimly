import { getCurriculumImages } from "@/lib/curriculum/data/images";
import type { ImageKind } from "@/lib/curriculum/image";
import { ImageThumbnail } from "./image-thumbnail";

/** Names remain visible; artwork is supplementary and omitted when absent. */
export async function CurriculumImage({ kind, id, name }: { kind: ImageKind; id: string; name: string }) {
  const src = (await getCurriculumImages()).get(`${kind}:${id}`);
  return src ? <ImageThumbnail src={src} name={name} /> : null;
}
