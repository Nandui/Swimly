import { getCurriculumImages } from "@/modules/activities/features/curriculum/server/data/images";
import type { ImageKind } from "@/modules/activities/features/curriculum/server/image";
import { ImageThumbnail } from "@/modules/activities/features/curriculum/components/image-thumbnail";

/** Names remain visible; artwork is supplementary and omitted when absent. */
export async function CurriculumImage({ kind, id, name }: { kind: ImageKind; id: string; name: string }) {
  const src = (await getCurriculumImages()).get(`${kind}:${id}`);
  return src ? <ImageThumbnail src={src} name={name} /> : null;
}
