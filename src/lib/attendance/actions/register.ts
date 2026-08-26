"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { canMarkRegister } from "@/lib/attendance/access";
import { describeRegister } from "@/lib/attendance/summary";
import { logAudit } from "@/lib/audit";
import { requireManage } from "@/lib/authz";
import { DAY_META, courseLabel } from "@/lib/courses/constants";
import { formatDate, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { prisma } from "@/lib/prisma";

/** The register is written by one action carrying the whole class.
 *
 *  Next dispatches Server Actions one at a time per client, so one call per
 *  swimmer would queue twenty round trips on poolside wifi. Batching also means
 *  a dropped connection leaves the register intact in the tab and retryable,
 *  which per-tick autosave loses. */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const markSchema = z.object({
  courseId: z.string().min(1),
  // A string, not a Date: unambiguous across the action boundary and checkable
  // with a regex.
  date: z.string().regex(ISO_DATE, "That is not a date."),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE"]),
        note: z.string().trim().max(200).optional(),
      })
    )
    // Capped so a malformed client cannot post fifty thousand rows.
    .max(200, "That is more swimmers than a register can hold."),
  classNote: z.string().trim().max(300).optional(),
});

export type MarkRegisterInput = z.infer<typeof markSchema>;

export async function markRegister(input: MarkRegisterInput): Promise<ActionResult> {
  const session = await requireManage();

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, date: iso, marks, classNote } = parsed.data;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      archivedAt: true,
      instructorId: true,
      level: { select: { name: true, programmeId: true } },
    },
  });
  if (!course) return fail("That course no longer exists.");
  if (course.archivedAt) return fail("That course is archived.");

  if (
    !canMarkRegister({
      role: session.user.role,
      userId: session.user.id,
      instructorId: course.instructorId,
    })
  ) {
    return fail("That is not your class. An admin can reassign it if you are covering.");
  }

  // Without session rows, these two lines are the only thing standing between
  // the table and attendance on days the class never ran.
  const date = parseDateOnly(iso);
  if (weekdayOf(date) !== course.dayOfWeek) {
    return fail(
      `${courseLabel(course)} runs on ${DAY_META[course.dayOfWeek].label}s. ${formatDate(date)} is not one.`
    );
  }
  if (iso > today()) return fail("You cannot take a register for a class that has not happened.");

  const [enrolled, existingRows] = await Promise.all([
    prisma.enrolment.findMany({
      where: {
        courseId,
        status: "ACTIVE",
        startedOn: { lte: date },
        OR: [{ endedOn: null }, { endedOn: { gte: date } }],
      },
      select: { studentId: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { courseId, date },
      select: { studentId: true, status: true },
    }),
  ]);

  // Enrolled on the day, or already on this register — the second clause is
  // what lets an amended past register still be saved after a transfer.
  const allowed = new Set([
    ...enrolled.map((row) => row.studentId),
    ...existingRows.map((row) => row.studentId),
  ]);
  const stranger = marks.find((mark) => !allowed.has(mark.studentId));
  if (stranger) {
    return fail("Somebody on this register is not in the class. Reload the page and try again.");
  }

  const students = await prisma.student.findMany({
    where: { id: { in: marks.map((mark) => mark.studentId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const nameById = new Map(students.map((student) => [student.id, fullName(student)]));

  const before = new Map<string, AttendanceStatus>(
    existingRows.map((row) => [row.studentId, row.status])
  );

  const description = describeRegister({
    classLabel: courseLabel(course),
    dateLabel: formatDate(date),
    before,
    after: marks,
    nameOf: (id) => nameById.get(id) ?? "Someone",
  });

  const noteChanged = await hasClassNoteChanged(courseId, date, classNote);

  // Nothing moved: no write, no audit row. Otherwise every "did that save?"
  // re-submit would add an entry, which is exactly the drowning this design
  // was trying to avoid.
  if (!description && !noteChanged) return ok();

  const markedByName = session.user.name ?? "Unknown";

  if (description) {
    await prisma.$transaction(
      marks.map((mark) =>
        prisma.attendanceRecord.upsert({
          where: {
            courseId_date_studentId: { courseId, date, studentId: mark.studentId },
          },
          create: {
            courseId,
            date,
            studentId: mark.studentId,
            status: mark.status,
            note: mark.note || null,
            markedById: session.user.id,
            markedByName,
          },
          update: {
            status: mark.status,
            note: mark.note || null,
            markedById: session.user.id,
            markedByName,
            markedAt: new Date(),
          },
        })
      )
    );
  }

  if (noteChanged) {
    if (classNote) {
      await prisma.classNote.upsert({
        where: { courseId_date: { courseId, date } },
        create: { courseId, date, note: classNote, byId: session.user.id, byName: markedByName },
        update: { note: classNote, byId: session.user.id, byName: markedByName },
      });
    } else {
      await prisma.classNote.deleteMany({ where: { courseId, date } });
    }
  }

  await logAudit({
    actorId: session.user.id,
    actorName: markedByName,
    action: description?.action ?? "attendance",
    entity: "Course",
    entityId: courseId,
    programmeId: course.level.programmeId,
    summary:
      description?.summary ??
      `${classNote ? "Noted" : "Cleared the note"} on ${courseLabel(course)} for ${formatDate(date)}` +
        (classNote ? ` — ${classNote}` : ""),
  });

  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/today");
  revalidatePath("/");
  return ok();
}

async function hasClassNoteChanged(
  courseId: string,
  date: Date,
  next: string | undefined
): Promise<boolean> {
  const existing = await prisma.classNote.findUnique({
    where: { courseId_date: { courseId, date } },
    select: { note: true },
  });
  return (existing?.note ?? "") !== (next ?? "");
}
