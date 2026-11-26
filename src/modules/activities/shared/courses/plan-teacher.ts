import { logAudit } from "@/lib/audit";
import { staffByIds } from "@/lib/directory";
import { isDateOnly, parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { weekdayOfIso } from "@/modules/activities/shared/attendance/dates";
import { courseName } from "@/modules/activities/shared/courses/constants";

/** Who to plan on one lesson: `userId` null plans nobody. `by` is who chose: a person on the
 *  rota's Plan, or an outside app through the classes API (no account, so no id). */
export type TeacherPlan = { ref: string; siteId: string; date: string; userId: string | null; by: { id: string | null; name: string } };

/** Plan who teaches a class on a date: the one record the rota's Plan and the swim school both
 *  read (`ClassPlannedTeacher`; owner decision, 16 October 2026). Every way of choosing a class's
 *  teacher ends here, so the checks and the audit row are the same whoever asks. The caller has
 *  checked that whoever asks may plan at that site. The class's start record (`ClassCover`) is
 *  never written here: it is made when the class starts. */
export async function planClassTeacher({ ref, siteId, date, userId, by }: TeacherPlan): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isDateOnly(date)) return { ok: false, error: "Choose a date." };
  const course = await prisma.course.findFirst({ where: { id: ref, clubId: siteId, archivedAt: null }, select: { id: true, dayOfWeek: true, name: true, level: { select: { name: true } } } });
  if (!course) return { ok: false, error: "That class is no longer on the timetable." };
  if (weekdayOfIso(date) !== course.dayOfWeek) return { ok: false, error: "That class does not run on that day." };
  const on = parseDateOnly(date);
  if (await prisma.classCancellation.findFirst({ where: { courseId: ref, date: on }, select: { id: true } })) return { ok: false, error: "That class is cancelled that day." };
  if (await prisma.classCover.findFirst({ where: { courseId: ref, date: on }, select: { id: true } })) return { ok: false, error: "That class has already started; its teacher is recorded on the register." };
  const teacher = userId ? (await staffByIds([userId])).get(userId) : null;
  if (userId && !teacher) return { ok: false, error: "That person is no longer active." };
  const label = `${courseName(course)} on ${date}`;
  await prisma.$transaction(async (tx) => {
    await tx.classPlannedTeacher.upsert({
      where: { courseId_date: { courseId: ref, date: on } },
      create: { courseId: ref, date: on, teacherId: userId, teacherName: teacher?.name ?? null, setById: by.id, setByName: by.name },
      update: { teacherId: userId, teacherName: teacher?.name ?? null, setById: by.id, setByName: by.name },
    });
    await logAudit({ actorId: by.id, actorName: by.name, action: "update", entity: "ClassPlannedTeacher", entityId: ref, clubId: siteId,
      summary: `Planned ${label} with ${teacher?.name ?? "nobody yet"}` }, tx);
  });
  return { ok: true };
}
