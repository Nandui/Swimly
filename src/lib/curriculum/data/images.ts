import { cache } from "react";
import { requireSession } from "@/lib/authz";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";
import { curriculumImageUrl } from "@/lib/curriculum/image";

/** One metadata query per render, shared by all the programme/level labels.
 * Image bytes never enter page props or the client-side navigation cache. */
export const getCurriculumImages = cache(async () => {
  await requireSession();
  const curriculum = await getSharedCurriculum();
  const programmes = curriculum.programmes;
  const images = new Map<string, string>();
  for (const programme of programmes) {
    const fallback = curriculumImageUrl("programme", programme.id, programme.imageVersion);
    if (fallback) for (const id of curriculum.programmeIds.variants(programme.id)) images.set(`programme:${id}`, fallback);
    for (const level of programme.levels) {
      const src = curriculumImageUrl("level", level.id, level.imageVersion) ?? fallback;
      if (src) for (const id of curriculum.levelIds.variants(level.id)) images.set(`level:${id}`, src);
    }
  }
  return images;
});
