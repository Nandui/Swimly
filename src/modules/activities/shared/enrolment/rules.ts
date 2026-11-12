import type { Prisma } from "@/generated/prisma/client";
import { sitesByIds } from "@/lib/directory";
import { hasEarnedPlace, previousLevel } from "@/modules/activities/shared/progression/rules";
import { readSharedCurriculum, sharedCourse } from "@/modules/activities/shared/curriculum/data/shared";

/** The placement rules every way into a class shares (Enrol, Move, Together's "Move them
 *  here"). Kept out of the actions file because that file is `"use server"`, where every export
 *  becomes a POST endpoint. Callers authenticate and lock first (withCourseSeat). */

export const COURSE_SELECT = {
  id: true, clubId: true, name: true, dayOfWeek: true, startMinutes: true, durationMinutes: true,
  capacity: true, archivedAt: true, levelId: true,
  level: { select: { id: true, name: true, archivedAt: true, programmeId: true, programme: { select: { archivedAt: true } } } },
} as const satisfies Prisma.CourseSelect;


/** Re-read placement against the locked class; a changed timetable cannot
 *  leave a new enrolment pinned to an old level. Transfers use the same rule. */
export async function placementFor(
  tx: Prisma.TransactionClient,
  studentId: string,
  course: Prisma.CourseGetPayload<{ select: typeof COURSE_SELECT }>
) {
  const curriculum = await readSharedCurriculum(tx);
  const target = sharedCourse(course, curriculum);
  const programmeId = { in: curriculum.programmeIds.variants(target.level.programmeId) };
  const orderedLevels = curriculum.levels.filter(l => l.programmeId === target.level.programmeId && !l.archivedAt);
  const [completions, actives, assessments] = await Promise.all([
    tx.levelCompletion.findMany({ where: { studentId, programmeId }, select: { levelId: true } }),
    tx.enrolment.findMany({ where: { studentId, programmeId, status: "ACTIVE" }, select: { levelId: true } }),
    tx.assessmentBooking.findMany({
      where: { studentId, status: "ATTENDED", outcomeLevelId: { not: null }, session: { programmeId } },
      select: { outcomeLevelId: true },
    }),
  ]);
  const resolve = curriculum.levelIds.resolve;
  return {
    earned: hasEarnedPlace({
      targetLevelId: target.levelId, orderedLevels,
      completedLevelIds: new Set(completions.map(row => resolve(row.levelId))),
      activeLevelIds: new Set(actives.map(row => resolve(row.levelId))),
      assessedLevelIds: new Set(assessments.flatMap(row => row.outcomeLevelId ? [resolve(row.outcomeLevelId)] : [])),
    }),
    below: previousLevel(target.levelId, orderedLevels),
  };
}

/** Parents are told lessons follow the centre where the child was assessed
 *  (owner rule, 20 October 2026). Staff may still enrol elsewhere, but are
 *  warned first. Uses the latest attended assessment in this programme. */
export const OTHER_SITE = "site:";
export async function assessedElsewhere(
  tx: Prisma.TransactionClient,
  studentId: string,
  course: { clubId: string; level: { programmeId: string } },
) {
  const curriculum = await readSharedCurriculum(tx);
  const latest = await tx.assessmentBooking.findFirst({
    where: { studentId, status: "ATTENDED", session: { programmeId: { in: curriculum.programmeIds.variants(course.level.programmeId) } } },
    orderBy: [{ session: { date: "desc" } }, { session: { startMinutes: "desc" } }],
    select: { session: { select: { clubId: true } } },
  });
  if (!latest || latest.session.clubId === course.clubId) return null;
  const sites = await sitesByIds([latest.session.clubId, course.clubId], tx);
  return {
    assessedAt: sites.get(latest.session.clubId)?.name ?? "another centre",
    classAt: sites.get(course.clubId)?.name ?? "this centre",
  };
}

