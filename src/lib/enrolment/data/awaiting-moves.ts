import type { Prisma } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { currentClubId } from "@/lib/clubs/current";
import { getSharedCurriculum, liveSharedLevel, sharedCourse } from "@/lib/curriculum/data/shared";
import { latestSharedMarks } from "@/lib/curriculum/shared";
import { parseDateOnly, today } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { nextLevel as nextCurriculumLevel } from "@/lib/progression/rules";

import { FOLLOW_UP_SELECT, followUpSummary } from "@/lib/enrolment/data/follow-up";

const PAGE_SIZE = 20;

/** A teaching handoff belongs to the original place and its site. A transfer
 * never copies it, including transfers to the other site or back again. */
export async function getAwaitingMoves(input: { q?: string; page?: number } = {}) {
  await requireSession();
  const [clubId, curriculum] = await Promise.all([currentClubId(), getSharedCurriculum()]);
  const q = (input.q ?? "").trim().slice(0, 100), date = parseDateOnly(today());
  const where = {
    status: "ACTIVE", readyToMoveAt: { not: null }, course: { clubId }, startedOn: { lte: date },
    AND: [{ OR: [{ endedOn: null }, { endedOn: { gte: date } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: date } }] }],
    student: { status: "ACTIVE", AND: q.split(/\s+/).filter(Boolean).map(term => ({ OR: [
      { firstName: { contains: term, mode: "insensitive" as const } },
      { lastName: { contains: term, mode: "insensitive" as const } },
      { memberNumber: { contains: term, mode: "insensitive" as const } },
    ] })) },
  } satisfies Prisma.EnrolmentWhereInput;
  const total = await prisma.enrolment.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(input.page) ? input.page! : 1));
  const rows = await prisma.enrolment.findMany({ where, orderBy: [{ readyToMoveAt: "asc" }, { id: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    select: {
      id: true, status: true, readyToMoveAt: true, readyToMoveByName: true, readyToMoveLevelId: true, readyToMoveNote: true,
      student: { select: { id: true, firstName: true, lastName: true, memberNumber: true, contactName: true, contactEmail: true, contactPhone: true, ...FOLLOW_UP_SELECT } },
      course: { select: { id: true, name: true, dayOfWeek: true, startMinutes: true, durationMinutes: true, location: true, archivedAt: true,
        club: { select: { id: true, name: true } }, instructor: { select: { name: true } }, level: { select: { id: true, name: true } } } },
    },
  });
  const studentIds = rows.map(row => row.student.id);
  const levels = rows.flatMap(row => row.readyToMoveLevelId ? [row.readyToMoveLevelId] : []);
  const competencyIds = [...new Set(levels.flatMap(id => liveSharedLevel(curriculum, id)?.competencies.flatMap(c => curriculum.competencyIds.variants(c.id)) ?? []))];
  const [marks, completions] = rows.length ? await Promise.all([
    prisma.competencyResult.findMany({ where: { studentId: { in: studentIds }, competencyId: { in: competencyIds } }, select: { studentId: true, competencyId: true, status: true, updatedAt: true, assessedOn: true } }),
    prisma.levelCompletion.findMany({ where: { studentId: { in: studentIds }, levelId: { in: levels.flatMap(curriculum.levelIds.variants) } }, select: { studentId: true, levelId: true } }),
  ]) : [[], []];
  const items = rows.map(row => {
    const level = row.readyToMoveLevelId ? liveSharedLevel(curriculum, row.readyToMoveLevelId) : null;
    const achieved = new Set(latestSharedMarks(marks.filter(mark => mark.studentId === row.student.id), curriculum.competencyIds.resolve).filter(mark => mark.status === "ACHIEVED").map(mark => mark.competencyId));
    const completed = level && completions.some(c => c.studentId === row.student.id && curriculum.levelIds.resolve(c.levelId) === level.id);
    const reviewReason = row.course.archivedAt ? "The current class is archived. Ask the instructor to review the move."
      : !level || curriculum.levelIds.resolve(row.course.level.id) !== level.id ? "The class level or curriculum has changed. Ask the instructor to confirm readiness again."
      : !completed || !level.competencies.length || level.competencies.some(c => !achieved.has(c.id)) ? "Progress has changed since confirmation. Ask the instructor to review readiness."
      : null;
    const nextLevel = level ? nextCurriculumLevel(level.id, curriculum.programme(level.programmeId)?.levels.filter(l => !l.archivedAt) ?? []) : null;
    const { enrolmentFollowUps, _count, ...student } = row.student;
    return { ...row, student, followUp: followUpSummary({ enrolmentFollowUps, _count }), course: sharedCourse(row.course, curriculum), reviewReason,
      completedLevelName: level?.name ?? (row.readyToMoveLevelId ? curriculum.level(row.readyToMoveLevelId)?.name : null),
      programmeName: level ? curriculum.programme(level.programmeId)?.name ?? "Programme" : "Programme",
      nextLevel: nextLevel ? { id: nextLevel.id, name: nextLevel.name } : null,
    };
  });
  return { items, total, page, pages, q };
}

export type AwaitingMovesResult = Awaited<ReturnType<typeof getAwaitingMoves>>;
