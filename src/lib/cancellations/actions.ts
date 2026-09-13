"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { courseName } from "@/lib/courses/constants";
import { readSharedCurriculum, sharedCourse } from "@/lib/curriculum/data/shared";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { formatDate, isDateOnly, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { fullName } from "@/lib/students/constants";

const cancelSchema = z.object({
  courseId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a valid date."),
  reason: z.string().trim().min(1, "Enter a reason for cancelling.").max(500, "Keep the reason within 500 characters."),
});

function refresh() {
  revalidatePath("/duty");
  revalidatePath("/cancellations");
  revalidatePath("/schedule");
  revalidatePath("/instructor");
  revalidatePath("/instructor/classes/[id]", "page");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/courses/[id]/class", "page");
  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/");
}

export async function cancelClassSession(input: z.infer<typeof cancelSchema>): Promise<ActionResult> {
  const session = await requirePermission("classes.cancel");
  if (!canSee(session, "duty")) throw new AuthorizationError("Duty manager access is required.");
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, date: iso, reason } = parsed.data;
  if (iso !== today()) return fail("Only today’s session can be cancelled here. Refresh the duty manager view.");
  const clubId = await currentClubId(), date = parseDateOnly(iso);
  const result = await withCourseSeat(courseId, async tx => {
    const raw = await tx.course.findUnique({ where: { id: courseId, clubId }, include: {
      level: { include: { programme: true } }, instructor: { select: { name: true } },
    } });
    if (!raw || raw.archivedAt) return fail("This class is no longer active at this site. Refresh the list.");
    if (weekdayOf(date) !== raw.dayOfWeek) return fail("This class does not run today. Refresh the list.");
    const existing = await tx.classCancellation.findUnique({ where: { courseId_date: { courseId, date } } });
    if (existing) return ok(); // Lost-response retries cannot duplicate billing work.
    const course = sharedCourse(raw, await readSharedCurriculum(tx));
    const [enrolments, cover, attendanceRecorded] = await Promise.all([
      tx.enrolment.findMany({ where: { courseId, status: "ACTIVE", startedOn: { lte: date },
        AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] },
          { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
      }, select: { student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } }),
      tx.classCover.findUnique({ where: { courseId_date: { courseId, date } } }),
      tx.attendanceRecord.count({ where: { courseId, date } }),
    ]);
    const swimmers = [...new Map(enrolments.map(row => [row.student.id, row.student])).values()];
    const cancelledByName = session.user.name ?? "Unknown";
    const cancellation = await tx.classCancellation.create({ data: {
      courseId, clubId, date, className: courseName(course), levelName: course.level.name,
      programmeName: course.level.programme.name, startMinutes: course.startMinutes,
      durationMinutes: course.durationMinutes, location: course.location,
      instructorName: cover?.coverByName ?? course.instructor?.name ?? null,
      reason, cancelledById: session.user.id, cancelledByName, attendanceRecorded,
      swimmers: { create: swimmers.map(swimmer => ({ studentId: swimmer.id, swimmerName: fullName(swimmer), memberNumber: swimmer.memberNumber })) },
    } });
    await logAudit({ actorId: session.user.id, actorName: cancelledByName, action: "cancel-session", entity: "Course", entityId: courseId,
      clubId, programmeId: course.level.programme.id,
      summary: `Cancelled ${courseName(course)} on ${formatDate(date)} — ${reason}. ${swimmers.length} swimmers awaiting billing follow-up.`,
      details: { cancellationId: cancellation.id, date: iso, reason, affectedSwimmers: swimmers.length, attendanceRecorded },
    }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

const notifySchema = z.object({
  courseId: z.string().min(1), cancellationId: z.string().min(1),
  note: z.string().trim().min(1, "Record who was notified and how.").max(500, "Keep the note within 500 characters."),
});

/** Records a human handoff; this action does not send messages or change bills. */
export async function markBillingNotified(input: z.infer<typeof notifySchema>): Promise<ActionResult> {
  const session = await requirePermission("billing.notify");
  if (!canSee(session, "cancellations")) throw new AuthorizationError("Cancelled classes access is required.");
  const parsed = notifySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, cancellationId, note } = parsed.data, clubId = await currentClubId();
  const result = await withCourseSeat(courseId, async tx => {
    const row = await tx.classCancellation.findFirst({ where: { id: cancellationId, courseId, clubId } });
    if (!row) return fail("That cancellation is not available at this site. Refresh the list.");
    if (row.billingNotifiedAt) return ok();
    const actorName = session.user.name ?? "Unknown";
    await tx.classCancellation.update({ where: { id: row.id }, data: {
      billingNotifiedAt: new Date(), billingNotifiedById: session.user.id, billingNotifiedByName: actorName, billingNote: note,
    } });
    await logAudit({ actorId: session.user.id, actorName, action: "billing-notified", entity: "Course", entityId: courseId, clubId,
      summary: `Recorded billing notification for ${row.className} on ${formatDate(row.date)} — ${note}`,
      details: { cancellationId: row.id, date: row.date.toISOString().slice(0, 10), note },
    }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}
