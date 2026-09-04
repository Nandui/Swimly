import type { CompetencyStatus } from "@/generated/prisma/client";
import { requireSession } from "@/lib/authz";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";
import { completionProgress, hasGraduated } from "@/lib/progression/rules";
import { prisma } from "@/lib/prisma";

export type CompetencyProgress = {
  id: string;
  name: string;
  description: string | null;
  status: CompetencyStatus | null;
  assessedOn: Date | null;
  assessedByName: string | null;
  note: string | null;
};

export type LevelProgress = {
  id: string;
  name: string;
  description: string | null;
  competencies: CompetencyProgress[];
  achieved: number;
  total: number;
  eligible: boolean;
  completedOn: Date | null;
  completionId: string | null;
  completionSnapshot: { achieved: number; total: number } | null;
  overrideReason: string | null;
  confirmedByName: string | null;
  isCurrent: boolean;
};

export type ProgrammeProgress = {
  programmeId: string;
  programmeName: string;
  levels: LevelProgress[];
  currentLevelId: string | null;
  graduated: boolean;
};

/** A student's standing, per programme.
 *
 *  "Current level" belongs to a (student, programme) pair, never to a student:
 *  a swimmer can be in Learn to Swim and in Squad at once, and a screen that
 *  says "Ava — Level 4" without saying which ladder is picking arbitrarily. */
export async function getStudentProgress(studentId: string): Promise<ProgrammeProgress[]> {
  await requireSession();

  const [enrolments, completions, results] = await Promise.all([
    prisma.enrolment.findMany({
      where: { studentId, status: "ACTIVE" },
      select: { levelId: true, programmeId: true, level: { select: { sortOrder: true } } },
    }),
    prisma.levelCompletion.findMany({
      where: { studentId },
      select: {
        id: true,
        levelId: true,
        programmeId: true,
        completedOn: true,
        competenciesAchieved: true,
        competencyCount: true,
        overrideReason: true,
        confirmedByName: true,
      },
    }),
    prisma.competencyResult.findMany({
      where: { studentId },
      select: {
        competencyId: true,
        status: true,
        assessedOn: true,
        assessedByName: true,
        note: true,
      },
    }),
  ]);

  const programmeIds = [
    ...new Set([
      ...enrolments.map((row) => row.programmeId),
      ...completions.map((row) => row.programmeId),
    ]),
  ];
  if (programmeIds.length === 0) return [];

  const programmes = await prisma.programme.findMany({
    where: { id: { in: programmeIds } },
    orderBy: [...LIST_ORDER],
    select: {
      id: true,
      name: true,
      levels: {
        where: LIVE,
        orderBy: [...LIST_ORDER],
        select: {
          id: true,
          name: true,
          description: true,
          sortOrder: true,
          competencies: {
            where: LIVE,
            orderBy: [...LIST_ORDER],
            select: { id: true, name: true, description: true },
          },
        },
      },
    },
  });

  const resultByCompetency = new Map(results.map((row) => [row.competencyId, row]));
  const completionByLevel = new Map(completions.map((row) => [row.levelId, row]));
  const achievedIds = new Set(
    results.filter((row) => row.status === "ACHIEVED").map((row) => row.competencyId)
  );

  return programmes.map((programme) => {
    // The highest live level they hold an active place at; failing that, the
    // highest one they have finished.
    const active = enrolments
      .filter((row) => row.programmeId === programme.id)
      .sort((a, b) => b.level.sortOrder - a.level.sortOrder);

    const completedIds = new Set(
      completions.filter((row) => row.programmeId === programme.id).map((row) => row.levelId)
    );

    const currentLevelId =
      active[0]?.levelId ??
      [...programme.levels].reverse().find((level) => completedIds.has(level.id))?.id ??
      null;

    const levels: LevelProgress[] = programme.levels.map((level) => {
      const competencies: CompetencyProgress[] = level.competencies.map((competency) => {
        const result = resultByCompetency.get(competency.id);
        return {
          id: competency.id,
          name: competency.name,
          description: competency.description,
          status: result?.status ?? null,
          assessedOn: result?.assessedOn ?? null,
          assessedByName: result?.assessedByName ?? null,
          note: result?.note ?? null,
        };
      });

      const progress = completionProgress(
        level.competencies.map((competency) => competency.id),
        achievedIds
      );
      const completion = completionByLevel.get(level.id) ?? null;

      return {
        id: level.id,
        name: level.name,
        description: level.description,
        competencies,
        achieved: progress.achieved,
        total: progress.total,
        eligible: progress.eligible,
        completedOn: completion?.completedOn ?? null,
        completionId: completion?.id ?? null,
        completionSnapshot: completion
          ? { achieved: completion.competenciesAchieved, total: completion.competencyCount }
          : null,
        overrideReason: completion?.overrideReason ?? null,
        confirmedByName: completion?.confirmedByName ?? null,
        isCurrent: level.id === currentLevelId,
      };
    });

    return {
      programmeId: programme.id,
      programmeName: programme.name,
      levels,
      currentLevelId,
      graduated: hasGraduated(programme.levels, completedIds),
    };
  });
}

/** The class screen: everyone on the roster with the course level's checklist
 *  filled in, so an instructor works down the poolside rather than opening one
 *  profile at a time. */
export async function getClassProgress(courseId: string) {
  await requireSession();

  // Two round trips, not three. The roster needs only the course id, so it is
  // read alongside the course; everything that needs the course's level or
  // competencies waits for it in one second batch.
  const [course, enrolments] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        dayOfWeek: true,
        startMinutes: true,
        levelId: true,
        level: {
          select: {
            id: true,
            name: true,
            programmeId: true,
            competencies: {
              where: LIVE,
              orderBy: [...LIST_ORDER],
              select: { id: true, name: true, description: true },
            },
          },
        },
      },
    }),
    prisma.enrolment.findMany({
      where: { courseId, status: "ACTIVE" },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
      select: {
        id: true,
        levelId: true,
        student: {
          select: { id: true, firstName: true, lastName: true, dateOfBirth: true },
        },
      },
    }),
  ]);
  if (!course) return null;

  const studentIds = enrolments.map((row) => row.student.id);
  const competencyIds = course.level.competencies.map((row) => row.id);

  const [orderedLevels, results, completions] = await Promise.all([
    // The ladder this course sits on, so the screen knows what "up" means.
    prisma.level.findMany({
      where: { programmeId: course.level.programmeId, ...LIVE },
      orderBy: [...LIST_ORDER],
      select: { id: true, name: true, sortOrder: true },
    }),
    studentIds.length && competencyIds.length
      ? prisma.competencyResult.findMany({
          where: { studentId: { in: studentIds }, competencyId: { in: competencyIds } },
          select: {
            studentId: true,
            competencyId: true,
            status: true,
            assessedByName: true,
            assessedOn: true,
          },
        })
      : Promise.resolve([]),
    studentIds.length
      ? prisma.levelCompletion.findMany({
          where: { studentId: { in: studentIds }, levelId: course.levelId },
          select: { studentId: true, completedOn: true },
        })
      : Promise.resolve([]),
  ]);

  type Mark = { status: CompetencyStatus; assessedByName: string; assessedOn: Date };
  const byStudent = new Map<string, Map<string, Mark>>();
  for (const result of results) {
    const map = byStudent.get(result.studentId) ?? new Map<string, Mark>();
    map.set(result.competencyId, result);
    byStudent.set(result.studentId, map);
  }
  const completedBy = new Map(completions.map((row) => [row.studentId, row.completedOn]));

  const swimmers = enrolments.map((enrolment) => {
    const marks = byStudent.get(enrolment.student.id) ?? new Map<string, Mark>();
    const achieved = competencyIds.filter((id) => marks.get(id)?.status === "ACHIEVED").length;
    return {
      enrolmentId: enrolment.id,
      student: enrolment.student,
      /** Placed at a different level from the one this class teaches. */
      offLevel: enrolment.levelId !== course.levelId,
      // Who set each mark, and when, travels with it: a competency is only
      // ever signed off by a named instructor.
      competencies: course.level.competencies.map((competency) => {
        const mark = marks.get(competency.id);
        return {
          ...competency,
          status: mark?.status ?? null,
          assessedByName: mark?.assessedByName ?? null,
          assessedOn: mark?.assessedOn ?? null,
        };
      }),
      achieved,
      total: competencyIds.length,
      eligible: competencyIds.length > 0 && achieved === competencyIds.length,
      completedOn: completedBy.get(enrolment.student.id) ?? null,
    };
  });

  return { course, swimmers, orderedLevels };
}

export type ClassProgress = NonNullable<Awaited<ReturnType<typeof getClassProgress>>>;
export type ClassSwimmer = ClassProgress["swimmers"][number];
