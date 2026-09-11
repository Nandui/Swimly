"use server";

import { revalidatePath } from "next/cache";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authz";
import { logAudit } from "@/lib/audit";
import { courseLabelWithSite as courseLabel } from "@/lib/courses/constants";
import { fullName } from "@/lib/students/constants";
import { formatDate, isDateOnly, parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withCourseSeat } from "@/lib/enrolment/seat";

/** A null date cancels the schedule. Scheduling never releases the place. */
export async function scheduleUnenrolment(id: string, date: string | null): Promise<ActionResult> {
  const session = await requirePermission("enrolment.manage");
  if (date !== null && (!isDateOnly(date) || date <= today())) return fail("Choose a future date, or use Unenrol to end the place now.");
  const source = await prisma.enrolment.findUnique({
    where: { id }, select: { courseId: true },
  });
  if (!source) return fail("That enrolment no longer exists.");
  const result = await withCourseSeat(source.courseId, async (tx) => {
    const row = await tx.enrolment.findUnique({
      where: { id },
      include: { student: true, course: { include: { level: true, club: { select: { name: true } } } } },
    });
    if (!row || row.status !== "ACTIVE") return fail("Only an active place can have a scheduled unenrolment.");
    const scheduledEndOn = date === null ? null : parseDateOnly(date);
    if (scheduledEndOn && scheduledEndOn < row.startedOn) return fail("Choose a date after the place starts.");
    if ((row.scheduledEndOn?.getTime() ?? null) === (scheduledEndOn?.getTime() ?? null)) return ok();
    await tx.enrolment.update({ where: { id }, data: { scheduledEndOn } });
    await logAudit({
      actorId: session.user.id, actorName: session.user.name ?? "Unknown", action: scheduledEndOn ? "schedule-withdrawal" : "cancel-withdrawal",
      entity: "Enrolment", entityId: id, programmeId: row.programmeId, clubId: row.course.clubId,
      summary: `${scheduledEndOn ? `Scheduled unenrolment on ${formatDate(scheduledEndOn)}` : "Cancelled scheduled unenrolment"} for ${fullName(row.student)} from ${courseLabel(row.course)}` +
        (row.scheduledEndOn ? ` (previously ${formatDate(row.scheduledEndOn)})` : ""),
    }, tx);
    return ok();
  });
  if (result.ok) {
    revalidatePath("/reception");
    revalidatePath("/courses/[id]", "page");
    revalidatePath("/students/[id]", "page");
  }
  return result;
}
