"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { AuthorizationError, can, requirePermission } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { canMarkRegister } from "@/lib/attendance/access";
import { withCourseSeat } from "@/lib/enrolment/seat";
import { isDateOnly, parseDateOnly, today, weekdayOf } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { courseLabel } from "@/lib/courses/constants";
import { readLesson } from "./data";
import {
  lessonDataSchema,
  same,
  sameKeys,
  type LessonSaveInput,
  type LessonSaveResult,
} from "./schema";
const schema = z.object({
  courseId: z.string().min(1).max(120),
  date: z.string().refine(isDateOnly),
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  data: lessonDataSchema,
  complete: z.boolean().optional(),
});
export async function saveLesson(
  input: LessonSaveInput,
): Promise<LessonSaveResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      error: "Some lesson details are invalid. Your draft is still here.",
    };
  const { courseId, date: iso, data, revision, complete = false } = parsed.data;
  try {
    const session = await requirePermission("attendance.mark");
    const clubId = await currentClubId();
    const result = await withCourseSeat(
      courseId,
      async (tx): Promise<LessonSaveResult> => {
        let current = await readLesson(tx, courseId, iso, clubId);
        if (!current)
          return {
            ok: false,
            error: "This class is no longer available in the current club.",
          };
        const { course, cover } = current;
        if (
          course.archivedAt ||
          !canMarkRegister({
            session,
            instructorId: course.instructorId,
            coverById: cover?.coverById,
          })
        )
          return {
            ok: false,
            error:
              "You cannot change this class. Check its cover and your permissions.",
          };
        if (weekdayOf(parseDateOnly(iso)) !== course.dayOfWeek || iso > today())
          return {
            ok: false,
            error:
              "Attendance can only be recorded on a date this class has run.",
          };
        // Lock only the authorized roster, never student IDs supplied by the
        // browser. Re-read versions after the locks; a concurrent creation is
        // protected by the unique student/competency constraint.
        if (current.ids.length) {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM "CompetencyResult" WHERE "studentId" IN (${Prisma.join(current.ids)}) ORDER BY id FOR UPDATE`,
          );
          current = (await readLesson(tx, courseId, iso, clubId))!;
        }
        const { saved } = current;
        if (Object.values(data.attendance).some(mark => mark.status === null && mark.note !== ""))
          return { ok: false, error: "Choose Present, Late or Absent before saving a swimmer’s attendance note. Your draft is still here." };
        const conflict = (): LessonSaveResult => ({
          ok: false,
          error:
            "The saved lesson changed. Review both versions before continuing.",
          conflict: saved,
        });
        if (
          !sameKeys(saved.data.attendance, data.attendance) ||
          !sameKeys(saved.data.competencies, data.competencies) ||
          Object.keys(data.competencies).some(
            (id) =>
              !sameKeys(data.competencies[id], saved.data.competencies[id]),
          )
        )
          return conflict();
        const attendanceChanged =
          !same(data.attendance, saved.data.attendance) ||
          data.note !== saved.data.note;
        const competencyChanged = !same(
          data.competencies,
          saved.data.competencies,
        );
        if (
          competencyChanged &&
          (!can(session, "progression.assess") ||
            course.level.archivedAt ||
            course.level.programme.archivedAt)
        )
          return {
            ok: false,
            error:
              "You do not have permission to assess this level, or the curriculum has been archived.",
          };
        if (
          !attendanceChanged &&
          !competencyChanged &&
          (!complete || saved.complete)
        )
          return { ok: true, saved };
        if (saved.revision !== revision) return conflict();
        if (complete && (attendanceChanged || competencyChanged))
          return {
            ok: false,
            error: "Save the latest marks before confirming attendance.",
          };
        if (
          complete &&
          (!current.ids.length ||
            Object.values(data.attendance).some((mark) => mark.status === null))
        )
          return {
            ok: false,
            error:
              "Mark every swimmer before selecting Done taking attendance.",
          };
        const date = parseDateOnly(iso);
        const byName = session.user.name ?? "Unknown";
        const audit = {
          actorId: session.user.id,
          actorName: byName,
          clubId,
          programmeId: course.level.programmeId,
        };
        const students = await tx.student.findMany({
          where: { id: { in: current.ids }, clubId },
          select: { id: true, firstName: true, lastName: true },
        });
        const names = new Map(
          students.map((student) => [
            student.id,
            `${student.firstName} ${student.lastName}`,
          ]),
        );
        const attendanceChanges: string[] = [];
        for (const [studentId, mark] of Object.entries(data.attendance)) {
          const before = saved.data.attendance[studentId];
          if (same(mark, before)) continue;
          if (mark.status === null)
            await tx.attendanceRecord.deleteMany({
              where: { courseId, date, studentId },
            });
          else
            await tx.attendanceRecord.upsert({
              where: { courseId_date_studentId: { courseId, date, studentId } },
              create: {
                courseId,
                date,
                studentId,
                status: mark.status,
                note: mark.note || null,
                markedById: session.user.id,
                markedByName: byName,
              },
              update: {
                status: mark.status,
                note: mark.note || null,
                markedById: session.user.id,
                markedByName: byName,
                markedAt: new Date(),
              },
            });
          attendanceChanges.push(
            `${names.get(studentId)}: ${before.status ?? "unmarked"} → ${mark.status ?? "unmarked"}${before.note !== mark.note ? `; note → ${mark.note || "cleared"}` : ""}`,
          );
        }
        if (data.note !== saved.data.note) {
          if (data.note)
            await tx.classNote.upsert({
              where: { courseId_date: { courseId, date } },
              create: {
                courseId,
                date,
                note: data.note,
                byId: session.user.id,
                byName,
              },
              update: { note: data.note, byId: session.user.id, byName },
            });
          else await tx.classNote.deleteMany({ where: { courseId, date } });
          attendanceChanges.push(`Class note → ${data.note || "cleared"}`);
        }
        if (attendanceChanged) {
          await tx.attendanceCompletion.deleteMany({
            where: { courseId, date },
          });
          await logAudit(
            {
              ...audit,
              action: "attendance",
              entity: "Course",
              entityId: courseId,
              summary: `${courseLabel(course)} on ${iso} — ${attendanceChanges.join("; ")}${saved.complete ? "; attendance reopened" : ""}`,
            },
            tx,
          );
        }
        const skillNames = new Map(
          course.level.competencies.map((skill) => [skill.id, skill.name]),
        );
        for (const [studentId, skills] of Object.entries(data.competencies)) {
          const changes: string[] = [];
          for (const [competencyId, status] of Object.entries(skills)) {
            const before = saved.data.competencies[studentId][competencyId];
            if (before === status) continue;
            const record = current.results.find(
              (row) =>
                row.studentId === studentId &&
                row.competencyId === competencyId,
            );
            if (status === null)
              await tx.competencyResult.deleteMany({
                where: { studentId, competencyId },
              });
            else {
              const values = {
                status,
                assessedOn: date,
                assessedById: session.user.id,
                assessedByName: byName,
                assessedInCourseId: courseId,
              };
              if (record)
                await tx.competencyResult.update({
                  where: { id: record.id },
                  data: values,
                });
              else
                await tx.competencyResult.create({
                  data: { studentId, competencyId, ...values },
                });
            }
            changes.push(
              `${skillNames.get(competencyId)}: ${before ?? "unmarked"} → ${status ?? "unmarked"}`,
            );
          }
          if (changes.length)
            await logAudit(
              {
                ...audit,
                action: "assess",
                entity: "Student",
                entityId: studentId,
                summary: `${names.get(studentId)} in ${course.level.name} on ${iso} — ${changes.join("; ")}`,
              },
              tx,
            );
        }
        if (complete) {
          await tx.attendanceCompletion.upsert({
            where: { courseId_date: { courseId, date } },
            create: {
              courseId,
              date,
              fingerprint: current.fingerprint,
              completedById: session.user.id,
              completedByName: byName,
            },
            update: {
              fingerprint: current.fingerprint,
              completedAt: new Date(),
              completedById: session.user.id,
              completedByName: byName,
            },
          });
          await logAudit(
            {
              ...audit,
              action: "attendance-complete",
              entity: "Course",
              entityId: courseId,
              summary: `Checked the roster for ${courseLabel(course)} on ${iso}; attendance complete (${current.ids.length} swimmers).`,
            },
            tx,
          );
        }
        const after = await readLesson(tx, courseId, iso, clubId);
        return { ok: true, saved: after!.saved };
      },
    );
    if (result.ok) {
      revalidatePath("/today");
      revalidatePath("/");
      revalidatePath("/courses/[id]", "page");
      revalidatePath("/courses/[id]/register", "page");
      revalidatePath("/courses/[id]/class", "page");
      revalidatePath("/students/[id]", "page");
    }
    return result;
  } catch (error) {
    if (error instanceof AuthorizationError)
      return {
        ok: false,
        error:
          "Your session or permissions changed. Sign in again; your draft is kept on this device.",
      };
    // Transport/database faults remain retryable. Version checks make an
    // uncertain response safe to retry without duplicating audit entries.
    return {
      ok: false,
      error:
        "The save could not be confirmed. Your draft is kept and will retry.",
      retry: true,
    };
  }
}
