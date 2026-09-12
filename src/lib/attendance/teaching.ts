import type { Prisma } from "@/generated/prisma/client";
import type { Session } from "next-auth";
import { can, canSee } from "@/lib/authz";
import { parseDateOnly, weekdayOf, today } from "@/lib/format";

export type TeachingContext = { courseId: string; date: string };

/** Called inside a transaction after the course lock, before any marks or
 * completion is written. Rechecking defeats stale tabs and fabricated IDs. */
export async function teachingError(
  tx: Prisma.TransactionClient,
  session: Session,
  context: TeachingContext,
  clubId: string,
  studentIds: string[] = [],
) {
  if (!canSee(session, "instructor") || !can(session, "attendance.mark"))
    return "Instructor access is required.";
  const date = parseDateOnly(context.date);
  const course = await tx.course.findUnique({
    where: { id: context.courseId, clubId },
    select: { archivedAt: true, dayOfWeek: true, levelId: true },
  });
  if (!course || course.archivedAt) return "This class is no longer active.";
  if (context.date > today() || weekdayOf(date) !== course.dayOfWeek)
    return "This class does not run on that date.";
  const claim = await tx.classCover.findUnique({
    where: { courseId_date: { courseId: context.courseId, date } },
    select: { coverById: true },
  });
  if (!claim || claim.coverById !== session.user.id)
    return "Start this class before marking it. A class started by another instructor is locked.";
  if (studentIds.length) {
    const enrolled = await tx.enrolment.findMany({
      where: {
        courseId: context.courseId,
        studentId: { in: studentIds },
        status: "ACTIVE",
        startedOn: { lte: date },
        OR: [{ endedOn: null }, { endedOn: { gte: date } }],
      },
      select: { studentId: true },
    });
    const allowed = new Set(enrolled.map((row) => row.studentId));
    if (studentIds.some((id) => !allowed.has(id)))
      return "A swimmer is no longer in this class. Reload before marking competencies.";
  }
  return null;
}
