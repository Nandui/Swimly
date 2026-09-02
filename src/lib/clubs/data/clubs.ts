import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

/** Every club, archived ones last, each with what it holds — so the page can
 *  say "3 programmes, 1,156 swimmers, 134 classes" without a query per row. */
export async function getClubs() {
  await requireSession();

  return prisma.club.findMany({
    orderBy: [{ archivedAt: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      archivedAt: true,
      _count: {
        select: {
          programmes: { where: { archivedAt: null } },
          students: { where: { status: "ACTIVE" } },
          courses: { where: { archivedAt: null } },
        },
      },
    },
  });
}

export type ClubRow = Awaited<ReturnType<typeof getClubs>>[number];
