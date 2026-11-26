import { z } from "zod";
import { isDateOnly } from "@/lib/format";
import { planClassTeacher } from "@/modules/activities/shared/courses/plan-teacher";
import { classSite, findInstructors, listLessons } from "@/modules/activities/features/classes-api/server/data";
import { ClassesApiError, type ClassesApiApp, idSchema, notFound, readBody } from "@/modules/activities/features/classes-api/server/http";

/** The classes API's one write: an outside app says who teaches a lesson. It writes the same
 *  plan the rota's Plan writes (`planClassTeacher`; owner decision, 16 October 2026: the Plan is
 *  the only place a class's teacher is chosen), so the Plan and the swim school show it at once
 *  and a later change on the Plan simply replaces it. The log names the app. */

const body = z.object({
  date: z.string().refine(isDateOnly, "Send the lesson's date as YYYY-MM-DD."),
  /** Exactly one of these three. `instructorId: null` leaves the lesson with nobody. */
  instructorId: idSchema.nullable().optional(),
  instructorEmail: z.string().trim().email("Send a full email address.").max(254).optional(),
  instructorName: z.string().trim().min(1).max(120).optional(),
}).strict().refine((b) => [b.instructorId !== undefined, b.instructorEmail !== undefined, b.instructorName !== undefined].filter(Boolean).length === 1,
  "Send exactly one of instructorId, instructorEmail or instructorName.");

export async function assignInstructor(request: Request, app: ClassesApiApp, classId: string) {
  const input = await readBody(request, body);
  // Authorize: the app's key was checked by the router; the class must be one the API speaks of.
  const siteId = await classSite(classId) ?? notFound();
  let userId: string | null = null;
  if (input.instructorId !== null) {
    const found = await findInstructors(input.instructorId !== undefined ? { id: input.instructorId } : input.instructorEmail !== undefined ? { email: input.instructorEmail } : { name: input.instructorName! });
    if (found.length === 0) throw new ClassesApiError(422, "INSTRUCTOR_NOT_FOUND", "No active member of staff who can teach matches that. See GET /instructors.");
    if (found.length > 1) throw new ClassesApiError(409, "INSTRUCTOR_AMBIGUOUS", "More than one person has that name. Send instructorId instead.");
    userId = found[0].id;
  }
  const result = await planClassTeacher({ ref: classId, siteId, date: input.date, userId, by: { id: null, name: `${app.name} (API)` } });
  if (!result.ok) throw new ClassesApiError(409, "CANNOT_ASSIGN", result.error);
  const [lesson] = await listLessons({ from: input.date, days: 1, siteId, classId });
  return lesson ?? notFound();
}
