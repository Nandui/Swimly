"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { logAudit } from "@/lib/audit";
import { AuthorizationError, canSee, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { withOneStaff } from "@/lib/directory";
import { prisma } from "@/lib/prisma";
import { formatDate, formatTime, isDateOnly, parseDateOnly, plural, today, weekdayOf } from "@/lib/format";
import { courseName } from "@/modules/activities/shared/courses/constants";
import { dayTeacherId, plannedTeachers } from "@/modules/activities/shared/courses/planned";
import { readSharedCurriculum, sharedCourse } from "@/modules/activities/shared/curriculum/data/shared";
import { withCourseSeat } from "@/modules/activities/shared/enrolment/seat";
import { fullName } from "@/modules/activities/shared/students/constants";

/** Merging one of today's classes into another at the same level, when there are not
 *  enough instructors or something happened on the day (owner request, 9 November 2026).
 *  The same people who cancel sessions merge them, from Duty manager, for today only. */

const mergeSchema = z.object({
  fromCourseId: z.string().min(1),
  intoCourseId: z.string().min(1),
  date: z.string().refine(isDateOnly, "Choose a valid date."),
  reason: z.string().trim().min(1, "Enter a reason for merging.").max(500, "Keep the reason within 500 characters."),
});

function refresh() {
  revalidatePath("/duty");
  revalidatePath("/duty/merged");
  revalidatePath("/schedule");
  revalidatePath("/instructor");
  revalidatePath("/instructor/classes/[id]", "page");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/courses/[id]/class", "page");
  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/");
}

async function dutySession() {
  const session = await requirePermission("classes.cancel");
  if (!canSee(session, "duty")) throw new AuthorizationError("Duty manager access is required.");
  return session;
}

export async function mergeClassSession(input: z.infer<typeof mergeSchema>): Promise<ActionResult> {
  const session = await dutySession();
  const parsed = mergeSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { fromCourseId, intoCourseId, date: iso, reason } = parsed.data;
  if (fromCourseId === intoCourseId) return fail("Choose a different class to merge into.");
  if (iso !== today()) return fail("Only today’s classes can be merged here. Refresh the duty manager view.");
  const clubId = await currentClubId(), date = parseDateOnly(iso);
  const result = await withCourseSeat([fromCourseId, intoCourseId], async tx => {
    const existing = await tx.classMerge.findUnique({ where: { fromCourseId_date: { fromCourseId, date } } });
    // A lost-response retry lands once; a second, different merge is refused.
    if (existing) return existing.intoCourseId === intoCourseId ? ok() : fail("This class has already been merged today. Refresh the list.");
    const found = await tx.course.findMany({ where: { id: { in: [fromCourseId, intoCourseId] }, clubId }, include: { level: { include: { programme: true } } } });
    const fromRaw = found.find(c => c.id === fromCourseId), intoRaw = found.find(c => c.id === intoCourseId);
    if (!fromRaw || !intoRaw || fromRaw.archivedAt || intoRaw.archivedAt) return fail("One of these classes is no longer active at this site. Refresh the list.");
    if (weekdayOf(date) !== fromRaw.dayOfWeek || weekdayOf(date) !== intoRaw.dayOfWeek) return fail("Both classes must run today. Refresh the list.");
    if (fromRaw.levelId !== intoRaw.levelId) return fail("Classes can only be merged into a class at the same level.");
    const [cancelled, intoMergedAway, fromIsHost, attendance] = await Promise.all([
      tx.classCancellation.findMany({ where: { courseId: { in: [fromCourseId, intoCourseId] }, date }, select: { courseId: true } }),
      tx.classMerge.findUnique({ where: { fromCourseId_date: { fromCourseId: intoCourseId, date } }, select: { id: true } }),
      tx.classMerge.count({ where: { intoCourseId: fromCourseId, date } }),
      tx.attendanceRecord.count({ where: { courseId: fromCourseId, date } }),
    ]);
    if (cancelled.length) return fail("A cancelled session cannot be merged or merged into.");
    if (intoMergedAway) return fail("That class has itself been merged into another today. Choose the class it joined.");
    if (fromIsHost) return fail("Other classes have joined this one today. Merge into a different class, or undo those merges first.");
    if (attendance) return fail("This class already has attendance recorded today, so it cannot be merged.");

    const curriculum = await readSharedCurriculum(tx);
    const from = sharedCourse(fromRaw, curriculum);
    const into = sharedCourse(await withOneStaff(intoRaw, "instructorId", "instructor", tx), curriculum);
    const [enrolments, cover, planned] = await Promise.all([
      tx.enrolment.findMany({ where: { courseId: fromCourseId, status: "ACTIVE", startedOn: { lte: date },
        AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
      }, select: { student: { select: { id: true, firstName: true, lastName: true, memberNumber: true } } } }),
      tx.classCover.findUnique({ where: { courseId_date: { courseId: intoCourseId, date } }, select: { coverByName: true } }),
      plannedTeachers([intoCourseId], iso, tx),
    ]);
    const swimmers = [...new Map(enrolments.map(row => [row.student.id, row.student])).values()];
    const plan = planned.get(intoCourseId);
    const instructorName = cover?.coverByName ?? (plan ? plan.teacherName : dayTeacherId(intoRaw.instructorId, undefined, iso) ? into.instructor?.name ?? null : null);
    const mergedByName = session.user.name ?? "Unknown";
    const fromName = courseName(from), intoName = courseName(into);
    const merge = await tx.classMerge.create({ data: {
      clubId, date, fromCourseId, intoCourseId, levelName: from.level.name, programmeName: from.level.programme.name,
      fromClassName: fromName, fromStartMinutes: from.startMinutes, intoClassName: intoName, intoStartMinutes: into.startMinutes,
      intoLocation: into.location, instructorName, reason, mergedById: session.user.id, mergedByName,
      swimmers: { create: swimmers.map(s => ({ studentId: s.id, swimmerName: fullName(s), memberNumber: s.memberNumber })) },
    } });
    await logAudit({ actorId: session.user.id, actorName: mergedByName, action: "merge-session", entity: "Course", entityId: fromCourseId,
      clubId, programmeId: from.level.programme.id,
      summary: `Merged ${fromName} (${formatTime(from.startMinutes)}) into ${intoName} (${formatTime(into.startMinutes)}) on ${formatDate(date)}: ${reason}. ${plural(swimmers.length, "swimmer")} moved for the day.`,
      details: { mergeId: merge.id, date: iso, intoCourseId, reason, swimmers: swimmers.length },
    }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}

const undoSchema = z.object({ mergeId: z.string().min(1) });

/** Puts a merged class back for the day, before any of its swimmers has been marked. */
export async function undoClassMerge(input: z.infer<typeof undoSchema>): Promise<ActionResult> {
  const session = await dutySession();
  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const clubId = await currentClubId();
  const found = await prisma.classMerge.findFirst({
    where: { id: parsed.data.mergeId, clubId }, select: { fromCourseId: true, intoCourseId: true },
  });
  if (!found) return ok(); // Already undone: a retry lands once.
  const result = await withCourseSeat([found.fromCourseId, found.intoCourseId], async tx => {
    const merge = await tx.classMerge.findFirst({ where: { id: parsed.data.mergeId, clubId }, include: { swimmers: { select: { studentId: true } } } });
    if (!merge) return ok();
    if (merge.date.toISOString().slice(0, 10) !== today()) return fail("Only today’s merges can be undone.");
    const marked = await tx.attendanceRecord.count({ where: { courseId: merge.fromCourseId, date: merge.date, studentId: { in: merge.swimmers.map(s => s.studentId) } } });
    if (marked) return fail("Attendance has already been taken for these swimmers on the class they joined, so the merge stays.");
    await tx.classMerge.delete({ where: { id: merge.id } });
    const actorName = session.user.name ?? "Unknown";
    await logAudit({ actorId: session.user.id, actorName, action: "unmerge-session", entity: "Course", entityId: merge.fromCourseId, clubId,
      summary: `Undid the merge of ${merge.fromClassName} into ${merge.intoClassName} on ${formatDate(merge.date)}. The class runs as usual.`,
      details: { mergeId: merge.id, date: merge.date.toISOString().slice(0, 10), intoCourseId: merge.intoCourseId, reason: merge.reason },
    }, tx);
    return ok();
  });
  if (result.ok) refresh();
  return result;
}
