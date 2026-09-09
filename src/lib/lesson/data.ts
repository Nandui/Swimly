import { attendanceFingerprint, lessonRevision } from "./revision";
import type { Prisma } from "@/generated/prisma/client";
import { currentClubId } from "@/lib/clubs/current";
import { requirePermission } from "@/lib/authz";
import { parseDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import type { LessonData, SavedLesson } from "./schema";
export async function readLesson(
  tx: Prisma.TransactionClient,
  courseId: string,
  iso: string,
  clubId: string,
) {
  const date = parseDateOnly(iso);
  const course = await tx.course.findUnique({
    where: { id: courseId, clubId },
    select: {
      id: true,
      name: true,
      dayOfWeek: true,
      startMinutes: true,
      instructorId: true,
      archivedAt: true,
      levelId: true,
      level: {
        select: {
          name: true,
          archivedAt: true,
          programmeId: true,
          programme: { select: { archivedAt: true } },
          competencies: {
            where: { archivedAt: null },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          },
        },
      },
    },
  });
  if (!course) return null;
  const [enrolled, records, note, completion, cover] = await Promise.all([
    tx.enrolment.findMany({
      where: {
        courseId,
        status: "ACTIVE",
        startedOn: { lte: date },
        OR: [{ endedOn: null }, { endedOn: { gte: date } }],
        student: { clubId },
      },
      select: { studentId: true },
    }),
    tx.attendanceRecord.findMany({
      where: { courseId, date, student: { clubId } },
      orderBy: { studentId: "asc" },
      select: { studentId: true, status: true, note: true, markedAt: true },
    }),
    tx.classNote.findUnique({ where: { courseId_date: { courseId, date } } }),
    tx.attendanceCompletion.findUnique({
      where: { courseId_date: { courseId, date } },
    }),
    tx.classCover.findUnique({
      where: { courseId_date: { courseId, date } },
      select: { coverById: true },
    }),
  ]);
  const ids = [
    ...new Set([
      ...enrolled.map((row) => row.studentId),
      ...records.map((row) => row.studentId),
    ]),
  ].sort();
  const skills = course.level.competencies.map((skill) => skill.id);
  const results = await tx.competencyResult.findMany({
    where: { studentId: { in: ids }, competencyId: { in: skills } },
    orderBy: [{ studentId: "asc" }, { competencyId: "asc" }],
    select: {
      id: true,
      studentId: true,
      competencyId: true,
      status: true,
      updatedAt: true,
    },
  });
  const marks = new Map(records.map((row) => [row.studentId, row]));
  const data: LessonData = {
    attendance: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          status: marks.get(id)?.status ?? null,
          note: marks.get(id)?.note ?? "",
        },
      ]),
    ),
    competencies: Object.fromEntries(
      ids.map((id) => [
        id,
        Object.fromEntries(
          skills.map((skill) => [
            skill,
            results.find(
              (row) => row.studentId === id && row.competencyId === skill,
            )?.status ?? null,
          ]),
        ),
      ]),
    ),
    note: note?.note ?? "",
  };
  const fingerprint = attendanceFingerprint(ids, records, data.note);
  const complete = completion?.fingerprint === fingerprint;
  const saved: SavedLesson = {
    data,
    complete,
    revision: lessonRevision([
      courseId,
      iso,
      course.levelId,
      ids,
      skills,
      records,
      results,
      note?.updatedAt,
      completion?.completedAt,
      complete,
    ]),
  };
  return {
    course,
    cover,
    ids,
    results,
    records,
    completion,
    fingerprint,
    saved,
  };
}
export async function getLesson(courseId: string, iso: string) {
  await requirePermission("attendance.mark");
  return readLesson(prisma, courseId, iso, await currentClubId());
}
