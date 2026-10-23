import { addDaysIso, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { getCoursesOnDay } from "@/modules/activities/shared/courses/data/courses";
import { type Planned, withPlanned } from "@/modules/activities/shared/courses/day-teacher";

/** Who teaches each class on a date (owner decisions, 6 and 16 October 2026: the rota plans swim
 *  teachers, and "we do not have a set instructor anymore, the instructor is defined via the
 *  plan"). The teacher planned for that date (`ClassPlannedTeacher`, written through the
 *  commitments seam) teaches it; planned with nobody it has none, nor (after the grace day in
 *  `day-teacher.ts`) when nothing is planned. The start record (`ClassCover`) still says who
 *  actually started it. */

export { USUAL_INSTRUCTOR_UNTIL, dayTeacherId, withPlanned, type Planned } from "@/modules/activities/shared/courses/day-teacher";

type Db = Pick<Prisma.TransactionClient, "classPlannedTeacher">;

export async function plannedTeachers(courseIds: readonly string[], iso: string, db: Db = prisma) {
  if (!courseIds.length) return new Map<string, Planned>();
  const rows = await db.classPlannedTeacher.findMany({ where: { courseId: { in: [...courseIds] }, date: parseDateOnly(iso) }, select: { courseId: true, teacherId: true, teacherName: true } });
  return new Map(rows.map((r) => [r.courseId, { teacherId: r.teacherId, teacherName: r.teacherName }]));
}

/** The classes on a date at the current site, each taught by that date's teacher. */
export async function getCoursesOnDate(iso: string) {
  const rows = await getCoursesOnDay(weekdayOfIso(iso));
  return withPlanned(rows, await plannedTeachers(rows.map((r) => r.id), iso), iso);
}

/** Who teaches a class's next lesson, today or later in the week: the date, that day's teacher
 *  (null when nobody is chosen yet) and whether the rota Plan chose them (`planned`), not the
 *  swim school's old list during the grace. */
export async function nextLessonTeacher<T extends { id: string; dayOfWeek: string; instructorId: string | null; instructor: { id: string; name: string } | null }>(course: T, fromIso: string) {
  let iso = fromIso;
  for (let i = 0; i < 6 && weekdayOfIso(iso) !== course.dayOfWeek; i++) iso = addDaysIso(iso, 1);
  const [row] = withPlanned([course], await plannedTeachers([course.id], iso), iso);
  return { iso, name: row.instructor?.name ?? null, planned: row.planned };
}
