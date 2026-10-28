"use server";

import { randomUUID } from "node:crypto";
import { dayTeacherId, plannedTeachers } from "@/modules/activities/shared/courses/planned";
import { withOneStaff } from "@/lib/directory";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import type { Session } from "next-auth";
import { AuthorizationError, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { prisma } from "@/lib/prisma";
import { courseName } from "@/modules/activities/shared/courses/constants";
import { readSharedCurriculum, sharedCourse } from "@/modules/activities/shared/curriculum/data/shared";
import { withCourseSeat } from "@/modules/activities/shared/enrolment/seat";
import { formatDate, isDateOnly, minutesNow, parseDateOnly, plural, today, weekdayOf } from "@/lib/format";
import { sessionRoster } from "@/modules/activities/shared/cancellations/roster";
import { inCancelWindow, undoBlocker } from "@/modules/activities/shared/cancellations/window";

const reason = z.string().trim().min(1, "Enter a reason for cancelling.").max(500, "Keep the reason within 500 characters.");
const date = z.string().refine(isDateOnly, "Choose a valid date.");
const cancelSchema = z.object({ courseId: z.string().min(1), date, reason });
const cancelManySchema = z.object({
  courseIds: z.array(z.string().min(1)).min(1, "Choose at least one class to cancel.").max(200),
  date, reason,
  /** Closing the whole day links the classes, so the closure can be undone at once. */
  closeDay: z.boolean(),
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

/** Cancels one dated session: today, or a day up to four weeks ahead (owner decision,
 *  28 October 2026). Duty manager and Schedule both call it; each page checks its own screen. */
export async function cancelClassSession(input: z.infer<typeof cancelSchema>): Promise<ActionResult> {
  const session = await requirePermission("classes.cancel");
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  return cancelSessions(session, { courseIds: [parsed.data.courseId], date: parsed.data.date, reason: parsed.data.reason, closeDay: false });
}

/** Cancels several of one day's classes with one reason; with `closeDay`, they are one closure. */
export async function cancelClassSessions(input: z.infer<typeof cancelManySchema>): Promise<ActionResult> {
  const session = await requirePermission("classes.cancel");
  const parsed = cancelManySchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  return cancelSessions(session, parsed.data);
}

async function cancelSessions(session: Session, input: z.infer<typeof cancelManySchema>): Promise<ActionResult> {
  const { date: iso, reason } = input, courseIds = [...new Set(input.courseIds)];
  if (!inCancelWindow(iso, today())) return fail("Choose today or a day in the next four weeks. Refresh the page.");
  const clubId = await currentClubId(), day = parseDateOnly(iso);
  const result = await withCourseSeat(courseIds, async tx => {
    // Check every class before writing any, so a stale list cancels nothing rather than part of it.
    const found = await tx.course.findMany({ where: { id: { in: courseIds }, clubId }, include: { level: { include: { programme: true } } } });
    const existing = new Set((await tx.classCancellation.findMany({ where: { courseId: { in: courseIds }, date: day }, select: { courseId: true } })).map(row => row.courseId));
    const curriculum = await readSharedCurriculum(tx);
    const fresh = [];
    for (const courseId of courseIds) {
      const row = found.find(course => course.id === courseId);
      if (!row || row.archivedAt) return fail("A class is no longer active at this site. Refresh the list.");
      if (weekdayOf(day) !== row.dayOfWeek) return fail(`${courseName(sharedCourse(row, curriculum))} does not run on ${formatDate(day)}. Refresh the list.`);
      if (!existing.has(courseId)) fresh.push(row); // Lost-response retries cannot duplicate billing work.
    }
    if (!fresh.length) return ok();
    const closureId = input.closeDay ? randomUUID() : null;
    const planned = await plannedTeachers(fresh.map(row => row.id), iso, tx);
    for (const row of fresh) await createCancellation(tx, session, { clubId, iso, reason, closureId, row: await withOneStaff(row, "instructorId", "instructor", tx), planned: planned.get(row.id), curriculum });
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

type FoundCourse = Prisma.CourseGetPayload<{ include: { level: { include: { programme: true } } } }> & { instructor?: { name: string } | null };

async function createCancellation(tx: Prisma.TransactionClient, session: Session, { clubId, iso, reason, closureId, row, planned, curriculum }: {
  clubId: string; iso: string; reason: string; closureId: string | null; row: FoundCourse;
  planned: { teacherName: string | null } | undefined; curriculum: Awaited<ReturnType<typeof readSharedCurriculum>>;
}) {
  const courseId = row.id, date = parseDateOnly(iso), course = sharedCourse(row, curriculum);
  const [swimmers, cover, attendanceRecorded] = await Promise.all([
    sessionRoster(tx, courseId, date),
    tx.classCover.findUnique({ where: { courseId_date: { courseId, date } } }),
    tx.attendanceRecord.count({ where: { courseId, date } }),
  ]);
  // That day's teacher, from the rota's plan (`dayTeacherId`).
  const dayTeacher = planned ? planned.teacherName : dayTeacherId(row.instructorId, undefined, iso) ? course.instructor?.name : null;
  const cancelledByName = session.user.name ?? "Unknown";
  const cancellation = await tx.classCancellation.create({ data: {
    courseId, clubId, date, className: courseName(course), levelName: course.level.name,
    programmeName: course.level.programme.name, startMinutes: course.startMinutes,
    durationMinutes: course.durationMinutes, location: course.location,
    instructorName: cover?.coverByName ?? dayTeacher ?? null,
    reason, cancelledById: session.user.id, cancelledByName, attendanceRecorded, closureId,
    swimmers: { create: swimmers },
  } });
  await logAudit({ actorId: session.user.id, actorName: cancelledByName, action: "cancel-session", entity: "Course", entityId: courseId,
    clubId, programmeId: course.level.programme.id,
    summary: `Cancelled ${courseName(course)} on ${formatDate(date)}${closureId ? " (day closed)" : ""}: ${reason}. ${plural(swimmers.length, "swimmer")} awaiting billing follow-up.`,
    details: { cancellationId: cancellation.id, date: iso, reason, affectedSwimmers: swimmers.length, attendanceRecorded, closureId },
  }, tx);
}

const undoSchema = z.object({ cancellationId: z.string().min(1) });
const undoClosureSchema = z.object({ closureId: z.string().min(1) });

/** Puts a cancelled session back (owner decision, 28 October 2026) while billing has not acted on
 *  it and the class has not started. The row is removed, as approved for undo; its audit entry
 *  keeps the full record: reason, who cancelled it and the swimmer list. */
export async function undoCancellation(input: z.infer<typeof undoSchema>): Promise<ActionResult> {
  const session = await requirePermission("classes.cancel");
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const target = await findCancellation({ id: parsed.data.cancellationId, clubId });
  if (!target) return fail("That cancellation is not available at this site. Refresh the list.");
  const result = await withCourseSeat(target.courseId, async tx => {
    const row = await findCancellation({ id: target.id, clubId }, tx);
    if (!row) return ok(); // Already undone by a retry or a colleague.
    const blocker = await blockerFor(tx, row);
    if (blocker) return fail(blocker);
    await removeCancellation(tx, session, row, false);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

/** Undoes a closed day: every class in it that can still be undone. Classes that billing has
 *  acted on, or that have started, stay cancelled and are named in the result. */
export async function undoClosure(input: z.infer<typeof undoClosureSchema>): Promise<ActionResult> {
  const session = await requirePermission("classes.cancel");
  const parsed = undoClosureSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const targets = await prisma.classCancellation.findMany({ where: { closureId: parsed.data.closureId, clubId }, select: { courseId: true } });
  if (!targets.length) return ok();
  const result = await withCourseSeat(targets.map(row => row.courseId), async tx => {
    const rows = await tx.classCancellation.findMany({ where: { closureId: parsed.data.closureId, clubId }, include: { swimmers: true }, orderBy: [{ startMinutes: "asc" }, { id: "asc" }] });
    const kept: string[] = [];
    for (const row of rows) {
      if (await blockerFor(tx, row)) { kept.push(row.className); continue; }
      await removeCancellation(tx, session, row, true);
    }
    if (kept.length === rows.length && rows.length) return fail("None of these classes can be put back: billing has acted on them or they have started.");
    if (kept.length) return fail(`The rest of the day is back on. Still cancelled, because billing has acted or they have started: ${kept.join(", ")}.`);
    return ok();
  });
  // A partial undo still changed the day, so refresh either way.
  refresh();
  return result;
}

type Cancellation = Prisma.ClassCancellationGetPayload<{ include: { swimmers: true } }>;

async function findCancellation(where: { id: string; clubId: string }, tx: Prisma.TransactionClient = prisma) {
  return tx.classCancellation.findFirst({ where, include: { swimmers: true } });
}

async function blockerFor(tx: Prisma.TransactionClient, row: Cancellation) {
  const started = !!await tx.classCover.findUnique({ where: { courseId_date: { courseId: row.courseId, date: row.date } }, select: { id: true } });
  const recorded = await tx.attendanceRecord.count({ where: { courseId: row.courseId, date: row.date } });
  return undoBlocker({ ...row, attendanceRecorded: Math.max(row.attendanceRecorded, recorded) }, today(), minutesNow(), started);
}

async function removeCancellation(tx: Prisma.TransactionClient, session: Session, row: Cancellation, closure: boolean) {
  const actorName = session.user.name ?? "Unknown", iso = row.date.toISOString().slice(0, 10);
  await tx.cancelledClassSwimmer.deleteMany({ where: { cancellationId: row.id } });
  await tx.classCancellation.delete({ where: { id: row.id } });
  await logAudit({ actorId: session.user.id, actorName, action: "uncancel-session", entity: "Course", entityId: row.courseId, clubId: row.clubId,
    summary: `Undid the cancellation of ${row.className} on ${formatDate(row.date)}${closure ? " (day reopened)" : ""}. The class runs as planned.`,
    details: { cancellationId: row.id, date: iso, reason: row.reason, closureId: row.closureId, cancelledById: row.cancelledById, cancelledByName: row.cancelledByName,
      cancelledAt: row.cancelledAt.toISOString(), swimmers: row.swimmers.map(s => ({ studentId: s.studentId, swimmerName: s.swimmerName, memberNumber: s.memberNumber })) },
  }, tx);
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
