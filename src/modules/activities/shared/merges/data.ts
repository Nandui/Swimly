import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

const SUMMARY = {
  id: true, fromCourseId: true, intoCourseId: true, fromClassName: true, fromStartMinutes: true,
  intoClassName: true, intoStartMinutes: true, reason: true, mergedByName: true,
  _count: { select: { swimmers: true } },
} as const;

/** One day's merges at the working site: which classes went away, and which took them in. */
export async function getMergesForDay(iso: string) {
  await requireSession();
  const rows = await prisma.classMerge.findMany({
    where: { clubId: await currentClubId(), date: parseDateOnly(iso) }, select: SUMMARY, orderBy: { fromStartMinutes: "asc" },
  });
  const into = new Map<string, typeof rows>();
  for (const row of rows) into.set(row.intoCourseId, [...(into.get(row.intoCourseId) ?? []), row]);
  return { away: new Map(rows.map(row => [row.fromCourseId, row])), into };
}
export type DayMerge = Awaited<ReturnType<typeof getMergesForDay>>["away"] extends Map<string, infer T> ? T : never;

/** The merge that took this class away on this date, if any. */
export async function getMergeAway(courseId: string, iso: string) {
  await requireSession();
  return prisma.classMerge.findFirst({
    where: { fromCourseId: courseId, date: parseDateOnly(iso), clubId: await currentClubId() }, select: SUMMARY,
  });
}

/** Swimmers merged into this class on this date, with the class whose attendance they count
 *  towards. Read inside the register's transaction too, so the roster and the save agree. */
export async function mergedSwimmers(db: Db, courseId: string, date: Date) {
  const merges = await db.classMerge.findMany({
    where: { intoCourseId: courseId, date },
    select: { fromCourseId: true, fromClassName: true, swimmers: { select: { studentId: true } } },
  });
  return new Map(merges.flatMap(merge => merge.swimmers.map(s => [s.studentId, { courseId: merge.fromCourseId, className: merge.fromClassName }] as const)));
}

const PAGE_SIZE = 25;

/** The Merged classes list: newest day first, at the working site. */
export async function getMergedClasses(page: number) {
  await requireSession();
  const where = { clubId: await currentClubId() };
  const [total, rows] = await Promise.all([
    prisma.classMerge.count({ where }),
    prisma.classMerge.findMany({
      where, orderBy: [{ date: "desc" }, { fromStartMinutes: "asc" }], skip: (Math.max(page, 1) - 1) * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, date: true, levelName: true, programmeName: true, fromClassName: true, fromStartMinutes: true,
        intoClassName: true, intoStartMinutes: true, intoLocation: true, instructorName: true, reason: true,
        mergedByName: true, mergedAt: true, swimmers: { select: { studentId: true, swimmerName: true }, orderBy: { swimmerName: "asc" } } },
    }),
  ]);
  return { total, rows, pageSize: PAGE_SIZE };
}
