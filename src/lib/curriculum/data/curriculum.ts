import { requireSession } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { LIST_ORDER, LIVE } from "@/lib/curriculum/constants";

/** Reads are plain async functions called straight from server components, and
 *  they authorize at the session level rather than the admin level: the
 *  *pages* that manage the curriculum are admin-tier, but level and programme
 *  names are needed all over the app by people who may not touch them. */

export async function getProgrammes(includeArchived = false) {
  await requireSession();

  return prisma.programme.findMany({
    where: includeArchived ? {} : LIVE,
    orderBy: [...LIST_ORDER],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      archivedAt: true,
      _count: { select: { levels: true, enrolments: true } },
    },
  });
}

export type ProgrammeRow = Awaited<ReturnType<typeof getProgrammes>>[number];

/** A whole programme as one document: its levels in order, each with its
 *  competencies. This is what `/programmes/[id]` renders, and it is one query
 *  rather than one per level. */
export async function getProgramme(id: string, includeArchived = false) {
  await requireSession();

  return prisma.programme.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      archivedAt: true,
      levels: {
        where: includeArchived ? {} : LIVE,
        orderBy: [...LIST_ORDER],
        select: {
          id: true,
          name: true,
          description: true,
          sortOrder: true,
          archivedAt: true,
          _count: { select: { courses: true, enrolments: true } },
          competencies: {
            where: includeArchived ? {} : LIVE,
            orderBy: [...LIST_ORDER],
            select: {
              id: true,
              name: true,
              description: true,
              sortOrder: true,
              archivedAt: true,
              _count: { select: { results: true } },
            },
          },
        },
      },
    },
  });
}

export type ProgrammeDetail = NonNullable<Awaited<ReturnType<typeof getProgramme>>>;
export type LevelDetail = ProgrammeDetail["levels"][number];
export type CompetencyDetail = LevelDetail["competencies"][number];

/** Counts for the overview sentence. */
export async function getCurriculumSummary() {
  await requireSession();

  const [programmes, levels, competencies] = await Promise.all([
    prisma.programme.count({ where: LIVE }),
    prisma.level.count({ where: LIVE }),
    prisma.competency.count({ where: LIVE }),
  ]);

  return { programmes, levels, competencies };
}

/** Every live level, flattened and labelled by programme — what a course form
 *  or an enrolment picker needs. */
export async function getLevelOptions() {
  await requireSession();

  const levels = await prisma.level.findMany({
    where: { ...LIVE, programme: LIVE },
    orderBy: [{ programme: { sortOrder: "asc" } }, ...LIST_ORDER],
    select: {
      id: true,
      name: true,
      sortOrder: true,
      programme: { select: { id: true, name: true, sortOrder: true } },
    },
  });

  return levels;
}

export type LevelOption = Awaited<ReturnType<typeof getLevelOptions>>[number];
