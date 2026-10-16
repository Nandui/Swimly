/** Who teaches a class on a date (owner decisions, 6 and 16 October 2026: the rota plans swim
 *  teachers, and "we do not have a set instructor anymore, the instructor is defined via the
 *  plan"). Pure rules with no database, so any reader can use them; `planned.ts` reads the plan. */

export type Planned = { teacherId: string | null; teacherName: string | null };

/** Two weeks' grace (owner choice, 16 October 2026): up to and including this day, a class
 *  nothing is planned for is still taught by the instructor stored on it. After it, only the
 *  Plan decides. The stored instructor is kept, never deleted. */
export const USUAL_INSTRUCTOR_UNTIL = "2026-11-01";

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
