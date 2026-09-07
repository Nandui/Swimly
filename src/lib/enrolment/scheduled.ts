import { prisma } from "@/lib/prisma";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { fullName } from "@/lib/students/constants";
import { formatDate, parseDateOnly, today } from "@/lib/format";

/** Idempotent: recheck after taking the same lock as cancellation and transfers.
 * Overdue dates catch up after an outage; history records the scheduled date. */
export async function processScheduledUnenrolments() {
  const dueOn = parseDateOnly(today());
  const due = await prisma.enrolment.findMany({
    where: { status: "ACTIVE", scheduledEndOn: { lte: dueOn } },
    select: { id: true, courseId: true },
    orderBy: [{ scheduledEndOn: "asc" }, { id: "asc" }],
  });
  let withdrawn = 0;
  for (const source of due) {
    const changed = await withCourseSeat(source.courseId, async (tx) => {
      const row = await tx.enrolment.findUnique({ where: { id: source.id }, include: { student: true, course: { include: { level: true } } } });
      if (!row || row.status !== "ACTIVE" || !row.scheduledEndOn || row.scheduledEndOn > dueOn) return false;
      await tx.enrolment.update({ where: { id: row.id }, data: { status: "WITHDRAWN", endedOn: row.scheduledEndOn, scheduledEndOn: null } });
      await logAudit({
        actorId: null, actorName: "Scheduled unenrolment", action: "withdraw", entity: "Enrolment", entityId: row.id,
        programmeId: row.programmeId, clubId: row.course.clubId,
        summary: `Automatically withdrew ${fullName(row.student)} from ${courseLabel(row.course)} on ${formatDate(row.scheduledEndOn)}`,
      }, tx);
      return true;
    });
    if (changed) withdrawn++;
  }
  return { withdrawn };
}
