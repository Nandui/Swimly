import { addDaysIso, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { getCoursesOnDay } from "@/modules/activities/shared/courses/data/courses";

/** Who teaches each class on a date (owner decisions, 6 and 16 October 2026: the rota plans swim
 *  teachers, and "we do not have a set instructor anymore, the instructor is defined via the
 *  plan"). The teacher planned for that date (`ClassPlannedTeacher`, written through the
 *  commitments seam) teaches it; planned with nobody, or not planned, it has no teacher. The
 *  start record (`ClassCover`) still says who actually started it. */

/** Two weeks' grace (owner choice, 16 October 2026): up to and including this day, a class
 *  nothing is planned for is still taught by the instructor stored on it. After it, only the
 *  Plan decides. The stored instructor is kept, never deleted. */
export const USUAL_INSTRUCTOR_UNTIL = "2026-11-01";

type Db = Pick<Prisma.TransactionClient, "classPlannedTeacher">;
export type Planned = { teacherId: string | null; teacherName: string | null };

export async function plannedTeachers(courseIds: readonly string[], iso: string, db: Db = prisma) {
  if (!courseIds.length) return new Map<string, Planned>();
  const rows = await db.classPlannedTeacher.findMany({ where: { courseId: { in: [...courseIds] }, date: parseDateOnly(iso) }, select: { courseId: true, teacherId: true, teacherName: true } });
  return new Map(rows.map((r) => [r.courseId, { teacherId: r.teacherId, teacherName: r.teacherName }]));
}

/** Who teaches a class on a date: its planned teacher (or nobody), else, during the grace, the
 *  instructor stored on it. */
export function dayTeacherId(instructorId: string | null, planned: Planned | undefined, iso: string) {
  if (planned) return planned.teacherId;
  return iso <= USUAL_INSTRUCTOR_UNTIL ? instructorId : null;
}

/** The rows with that date's teacher as their instructor, and the stored one kept. */
export function withPlanned<T extends { id: string; instructorId: string | null; instructor: { id: string; name: string } | null }>(rows: T[], planned: ReadonlyMap<string, Planned>, iso: string) {
  return rows.map((row) => {
    const p = planned.get(row.id);
    if (!p && iso <= USUAL_INSTRUCTOR_UNTIL) return { ...row, usualInstructorId: row.instructorId, planned: false };
    if (!p) return { ...row, instructorId: null, instructor: null, usualInstructorId: row.instructorId, planned: false };
    return { ...row, instructorId: p.teacherId, instructor: p.teacherId ? { id: p.teacherId, name: p.teacherName ?? "Someone" } : null, usualInstructorId: row.instructorId, planned: true };
  });
}

/** The classes on a date at the current site, each taught by that date's teacher. */
export async function getCoursesOnDate(iso: string) {
  const rows = await getCoursesOnDay(weekdayOfIso(iso));
  return withPlanned(rows, await plannedTeachers(rows.map((r) => r.id), iso), iso);
}

/** Who teaches a class's next lesson, today or later in the week: the date and that day's teacher
 *  (null when nobody is chosen yet). */
export async function nextLessonTeacher<T extends { id: string; dayOfWeek: string; instructorId: string | null; instructor: { id: string; name: string } | null }>(course: T, fromIso: string) {
  let iso = fromIso;
  for (let i = 0; i < 6 && weekdayOfIso(iso) !== course.dayOfWeek; i++) iso = addDaysIso(iso, 1);
  const [row] = withPlanned([course], await plannedTeachers([course.id], iso), iso);
  return { iso, name: row.instructor?.name ?? null };
}
