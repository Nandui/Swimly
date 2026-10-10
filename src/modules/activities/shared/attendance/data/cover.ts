import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/** Who confirmed they are teaching a class on a date, including its scheduled instructor. */

export async function getClassCover(courseId: string, iso: string) {
  await requireSession();

  return prisma.classCover.findUnique({
    where: { courseId_date: { courseId, date: parseDateOnly(iso) } },
    select: {
      coverById: true,
      coverByName: true,
      instructorId: true,
      instructorName: true,
      createdAt: true,
    },
  });
}

export type ClassCover = NonNullable<Awaited<ReturnType<typeof getClassCover>>>;

/** Every cover on one day in the current club, by course — for the deck
 *  screen, which lists the day's classes and says who is taking each. */
export async function getCoversForDay(iso: string) {
  await requireSession();

  const rows = await prisma.classCover.findMany({
    where: { date: parseDateOnly(iso), course: { clubId: await currentClubId() } },
    select: { courseId: true, coverById: true, coverByName: true, instructorId: true, instructorName: true },
  });

  return new Map(rows.map((row) => [row.courseId, row]));
}

/** What a cover says on a register: who took it, and for whom. */
export function coverLabel(cover: {
  coverById?: string | null;
  coverByName: string;
  instructorId?: string | null;
  instructorName: string | null;
}): string {
  if (cover.coverById && cover.coverById === cover.instructorId) return `Taught by ${cover.coverByName}`;
  return cover.instructorName
    ? `Taken by ${cover.coverByName}, covering for ${cover.instructorName}`
    : `Taken by ${cover.coverByName} — nobody was assigned`;
}
