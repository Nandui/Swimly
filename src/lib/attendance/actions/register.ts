"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { fail } from "@/lib/action-result";
import { canMarkRegister } from "@/lib/attendance/access";
import { describeRegister } from "@/lib/attendance/summary";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { DAY_META, courseLabel } from "@/lib/courses/constants";
import { formatDate, isDateOnly, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { fullName } from "@/lib/students/constants";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { savedRegister, type SavedRegister } from "@/lib/attendance/revision";

/** The register is written by one action carrying the whole class.
 *
 *  Next dispatches Server Actions one at a time per client, so one call per
 *  swimmer would queue twenty round trips on poolside wifi. Batching also means
 *  a dropped connection leaves the register intact in the tab and retryable,
 *  which per-tick autosave loses. */

const markSchema = z.object({
  courseId: z.string().min(1),
  // A string, not a Date: unambiguous across the action boundary and checkable
  // with a regex.
  date: z.string().refine(isDateOnly, "That is not a date."),
  marks: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "ABSENT", "LATE"]),
        note: z.string().trim().max(200).optional(),
      })
    )
    // Capped so a malformed client cannot post fifty thousand rows.
    .max(200, "That is more swimmers than a register can hold.")
    .refine((marks) => new Set(marks.map((mark) => mark.studentId)).size === marks.length, "A swimmer appears twice. Reload and try again."),
  revision: z.string().regex(/^[a-f0-9]{64}$/).nullable().default(null),
  classNote: z.string().trim().max(300).optional(),
});

export type MarkRegisterInput = z.input<typeof markSchema>;
export type RegisterSaveResult =
  | { ok: true; revision: string }
  | { ok: false; error: string; conflict?: SavedRegister };

export async function markRegister(input: MarkRegisterInput): Promise<RegisterSaveResult> {
  const session = await requirePermission("attendance.mark");

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { courseId, date: iso, marks, classNote } = parsed.data;
  const clubId = await currentClubId();

  const result = await withCourseSeat(courseId, async (tx): Promise<RegisterSaveResult> => {
    const course = await tx.course.findUnique({
      where: { id: courseId, clubId },
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
    if (!course) return fail("That class no longer exists.");
    if (course.archivedAt) return fail("That class is archived.");

    const date = parseDateOnly(iso);

    // Whoever took the class over that day may mark it, and the register says
    // they did.
    const cover = await tx.classCover.findUnique({
      where: { courseId_date: { courseId, date } },
      select: { coverById: true, coverByName: true, instructorName: true },
    });

    if (
      !canMarkRegister({ session, instructorId: course.instructorId, coverById: cover?.coverById })
    ) {
      return fail("That is not your class. Take it over first, or ask someone who can take attendance for any class.");
    }

    // Without session rows, these two lines are the only thing standing between
    // the table and attendance on days the class never ran.
    if (weekdayOf(date) !== course.dayOfWeek) {
      return fail(
        `${courseLabel(course)} runs on ${DAY_META[course.dayOfWeek].label}s. ${formatDate(date)} is not one.`
      );
    }
    if (iso > today()) return fail("You cannot take attendance for a class that has not happened.");

    const [enrolled, existingRows] = await Promise.all([
      tx.enrolment.findMany({
        where: {
          courseId,
          // Terminal statuses may have come from a waitlist; include them
          // only through an existing attendance record below.
          status: "ACTIVE",
          startedOn: { lte: date },
          OR: [{ endedOn: null }, { endedOn: { gte: date } }],
        },
        select: { studentId: true },
      }),
      tx.attendanceRecord.findMany({
        where: { courseId, date },
        select: { studentId: true, status: true, note: true },
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
      return fail("Somebody on this list is not in the class. Reload the page and try again.");
    }

    const students = await tx.student.findMany({
      where: { id: { in: marks.map((mark) => mark.studentId) }, clubId },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(students.map((student) => [student.id, fullName(student)]));
    if (students.length !== marks.length) return fail("A swimmer is not in this club. Reload and try again.");
    const previous = new Map(existingRows.map((row) => [row.studentId, row]));
    const changed = marks.filter((mark) => {
      const was = previous.get(mark.studentId);
      return !was || was.status !== mark.status || (was.note ?? "") !== (mark.note ?? "");
    });
    const noteChanges = changed.filter((mark) => (previous.get(mark.studentId)?.note ?? "") !== (mark.note ?? ""));

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

    const existingNote = await tx.classNote.findUnique({
      where: { courseId_date: { courseId, date } }, select: { note: true },
    });
    const current = savedRegister(courseId, iso, existingRows, existingNote?.note);
    const noteChanged = current.note !== (classNote ?? "");

    // Nothing moved: no write, no audit row. Otherwise every "did that save?"
    // re-submit would add an entry, which is exactly the drowning this design
    // was trying to avoid.
    if (changed.length === 0 && !noteChanged) return { ok: true, revision: current.revision };
    if (parsed.data.revision !== current.revision) {
      return {
        ok: false,
        error: "Review the saved register before replacing it. Your draft is still here.",
        conflict: current,
      };
    }

    await tx.attendanceCompletion.deleteMany({ where: { courseId, date } });

    const markedByName = session.user.name ?? "Unknown";

    if (changed.length > 0) {
      await Promise.all(
        changed.map((mark) =>
          tx.attendanceRecord.upsert({
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
        await tx.classNote.upsert({
          where: { courseId_date: { courseId, date } },
          create: { courseId, date, note: classNote, byId: session.user.id, byName: markedByName },
          update: { note: classNote, byId: session.user.id, byName: markedByName },
        });
      } else {
        await tx.classNote.deleteMany({ where: { courseId, date } });
      }
    }

    // The attendance sheet says who conducted the class when it was not its
    // instructor: the cover's name, and whose class it was.
    const conducted =
      cover && cover.coverById === session.user.id
        ? cover.instructorName
          ? ` — taken by ${markedByName}, covering for ${cover.instructorName}`
          : ` — taken by ${markedByName}, nobody having been assigned`
        : "";

    await logAudit({
      actorId: session.user.id,
      actorName: markedByName,
      action: description?.action ?? "attendance",
      entity: "Course",
      entityId: courseId,
      programmeId: course.level.programmeId,
      clubId,
      summary: [
        description?.summary,
        ...noteChanges.map((mark) => `${nameById.get(mark.studentId)} note → ${mark.note || "cleared"}`),
        noteChanged ? `${classNote ? "Noted" : "Cleared the note"} on ${courseLabel(course)} for ${formatDate(date)}${classNote ? ` — ${classNote}` : ""}` : null,
      ].filter(Boolean).join("; ") + conducted,
    }, tx);
    const after = new Map(existingRows.map(row => [row.studentId, row]));
    for (const mark of changed) after.set(mark.studentId, { ...mark, note: mark.note ?? null });
    return { ok: true, revision: savedRegister(courseId, iso, [...after.values()], classNote).revision };
  });
  if (!result.ok) return result;

  revalidatePath("/courses/[id]/register", "page");
  revalidatePath("/courses/[id]/class", "page");
  revalidatePath("/courses/[id]", "page");
  revalidatePath("/today");
  revalidatePath("/");
  return result;
}
