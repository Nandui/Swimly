"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { courseLabelWithSite as courseLabel } from "@/modules/activities/shared/courses/constants";
import { fullName } from "@/modules/activities/shared/students/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";
import { endAfterLesson, lastLessonError } from "@/modules/activities/shared/enrolment/last-lesson";
import { prisma } from "@/lib/prisma";
import { withCourseSeat } from "@/modules/activities/shared/enrolment/seat";

/** Staff choose the swimmer's last lesson; the place stays active through it
 *  and ends the day after. Null cancels the schedule. Scheduling never
 *  releases the place. */
export async function scheduleUnenrolment(id: string, lastLesson: string | null): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  const source = await prisma.enrolment.findUnique({
    where: { id }, select: { courseId: true },
  });
  if (!source) return fail("That enrolment no longer exists.");
  const result = await withCourseSeat(source.courseId, async (tx) => {
    const row = await tx.enrolment.findUnique({
      where: { id },
      include: { student: true, course: { include: { level: true } } },
    });
    if (!row || row.status !== "ACTIVE") return fail("Only an active place can have a scheduled unenrolment.");
    if (lastLesson !== null) {
      const error = lastLessonError(lastLesson, row.course, row.startedOn, today());
      if (error) return fail(error);
    }
    const scheduledEndOn = lastLesson === null ? null : parseDateOnly(endAfterLesson(lastLesson));
    if ((row.scheduledEndOn?.getTime() ?? null) === (scheduledEndOn?.getTime() ?? null)) return ok();
    await tx.enrolment.update({ where: { id }, data: { scheduledEndOn } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: scheduledEndOn ? "schedule-withdrawal" : "cancel-withdrawal",
      entity: "Enrolment", entityId: id, programmeId: row.programmeId, clubId: row.course.clubId,
      summary: `${lastLesson ? `Scheduled unenrolment after the lesson on ${formatDate(parseDateOnly(lastLesson))}` : "Cancelled scheduled unenrolment"} for ${fullName(row.student)} from ${courseLabel(row.course)}` +
        (row.scheduledEndOn ? ` (previously ending ${formatDate(row.scheduledEndOn)})` : ""),
    }, tx);
    return ok();
  });
  if (result.ok) {
    revalidatePath("/courses/[id]", "page");
    revalidatePath("/students/[id]", "page");
  }
  return result;
}
