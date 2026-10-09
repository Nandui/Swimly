import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { getCoursesOnDay } from "@/modules/activities/shared/courses/data/courses";

/** Who teaches each class on a date (owner decision, 6 October 2026: the rota plans swim
 *  teachers). A teacher planned for that date (`ClassPlannedTeacher`, written through the
 *  commitments seam) takes the place of the class's usual instructor; planned with nobody leaves
 *  it without one. The start record (`ClassCover`) still says who actually started it. */

type Db = Pick<Prisma.TransactionClient, "classPlannedTeacher">;
export type Planned = { teacherId: string | null; teacherName: string | null };

export async function plannedTeachers(courseIds: readonly string[], iso: string, db: Db = prisma) {
  if (!courseIds.length) return new Map<string, Planned>();
  const rows = await db.classPlannedTeacher.findMany({ where: { courseId: { in: [...courseIds] }, date: parseDateOnly(iso) }, select: { courseId: true, teacherId: true, teacherName: true } });
  return new Map(rows.map((r) => [r.courseId, { teacherId: r.teacherId, teacherName: r.teacherName }]));
}

/** The rows with that date's teacher as their instructor, and the usual one kept. */
export function withPlanned<T extends { id: string; instructorId: string | null; instructor: { id: string; name: string } | null }>(rows: T[], planned: ReadonlyMap<string, Planned>) {
  return rows.map((row) => {
    const p = planned.get(row.id);
    if (!p) return { ...row, usualInstructorId: row.instructorId, planned: false };
    return { ...row, instructorId: p.teacherId, instructor: p.teacherId ? { id: p.teacherId, name: p.teacherName ?? "Someone" } : null, usualInstructorId: row.instructorId, planned: true };
  });
}

/** The classes on a date at the current site, each taught by that date's teacher. */
export async function getCoursesOnDate(iso: string) {
  const rows = await getCoursesOnDay(weekdayOfIso(iso));
  return withPlanned(rows, await plannedTeachers(rows.map((r) => r.id), iso));
}
