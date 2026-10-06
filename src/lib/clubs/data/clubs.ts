import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Every club, archived ones last. What each site runs (programmes, swimmers,
 *  classes) comes from the modules through `siteSummaryLines`, not from here. */
export async function getClubs() {
  await requireSession();

  return prisma.club.findMany({
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      code: true,
      archivedAt: true,
    },
  });
}

export type ClubRow = Awaited<ReturnType<typeof getClubs>>[number];
