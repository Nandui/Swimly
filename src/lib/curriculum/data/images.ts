import { cache } from "react";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { curriculumImageUrl } from "@/lib/curriculum/image";

/** One metadata query per render, shared by all the programme/level labels.
 * Image bytes never enter page props or the client-side navigation cache. */
export const getCurriculumImages = cache(async () => {
  await requireSession();
  const programmes = await prisma.programme.findMany({
    where: { clubId: await currentClubId() },
    select: { id: true, imageVersion: true, levels: { select: { id: true, imageVersion: true } } },
  });
  const images = new Map<string, string>();
  for (const programme of programmes) {
    const fallback = curriculumImageUrl("programme", programme.id, programme.imageVersion);
    if (fallback) images.set(`programme:${programme.id}`, fallback);
    for (const level of programme.levels) {
      const src = curriculumImageUrl("level", level.id, level.imageVersion) ?? fallback;
      if (src) images.set(`level:${level.id}`, src);
    }
  }
  return images;
});
