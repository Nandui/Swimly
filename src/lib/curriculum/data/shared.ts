import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sharedIds } from "@/lib/curriculum/shared";

/** Internal reader: callers authenticate first. A transaction gets its own
 * snapshot; server pages share one catalogue read within the request. */
export async function readSharedCurriculum(db: Prisma.TransactionClient = prisma) {
  const programmes = await db.programme.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true, sharedWithId: true, name: true, description: true, sortOrder: true,
      archivedAt: true, imageVersion: true, clubId: true, club: { select: { id: true, name: true } },
      _count: { select: { enrolments: true } },
      levels: { select: {
        id: true, sharedWithId: true, programmeId: true, name: true, description: true,
        sortOrder: true, archivedAt: true, imageVersion: true,
        _count: { select: { courses: true, enrolments: true } },
        competencies: { select: {
          id: true, sharedWithId: true, levelId: true, name: true, description: true,
          sortOrder: true, archivedAt: true, _count: { select: { results: true } },
        } },
      } },
      assessmentTypes: { select: {
        id: true, sharedWithId: true, programmeId: true, name: true, description: true,
        sortOrder: true, archivedAt: true, _count: { select: { sessions: true } },
      } },
    },
  });
  const rawLevels = programmes.flatMap(p => p.levels);
  const rawCompetencies = rawLevels.flatMap(l => l.competencies);
  const rawTypes = programmes.flatMap(p => p.assessmentTypes);
  const programmeIds = sharedIds(programmes), levelIds = sharedIds(rawLevels), competencyIds = sharedIds(rawCompetencies), typeIds = sharedIds(rawTypes);
  const programmeById = new Map(programmes.map(p => [p.id, p]));
  const rawLevelById = new Map(rawLevels.map(l => [l.id, l]));
  const order = <T extends { sortOrder: number; name: string; id: string }>(rows: T[]) => rows.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const competencies = rawCompetencies.filter(c => !c.sharedWithId).map(c => ({ ...c, levelId: levelIds.resolve(c.levelId), _count: {
    results: rawCompetencies.filter(copy => competencyIds.resolve(copy.id) === c.id).reduce((n, copy) => n + copy._count.results, 0),
  } }));
  const levels = order(rawLevels.filter(l => !l.sharedWithId).map(l => {
    const p = programmeById.get(programmeIds.resolve(l.programmeId))!;
    const copies = rawLevels.filter(copy => levelIds.resolve(copy.id) === l.id);
    return { ...l, programmeId: p.id, programme: { id: p.id, name: p.name, sortOrder: p.sortOrder, archivedAt: p.archivedAt, clubId: p.clubId },
      competencies: order(competencies.filter(c => c.levelId === l.id)),
      _count: { courses: copies.reduce((n, c) => n + c._count.courses, 0), enrolments: copies.reduce((n, c) => n + c._count.enrolments, 0) },
    };
  }));
  const levelById = new Map(levels.map(l => [l.id, l]));
  const types = order(rawTypes.filter(t => !t.sharedWithId).map(t => ({ ...t, programmeId: programmeIds.resolve(t.programmeId), _count: { sessions: rawTypes.filter(copy => typeIds.resolve(copy.id) === t.id).reduce((n, copy) => n + copy._count.sessions, 0) } })));
  const catalogue = programmes.filter(p => !p.sharedWithId).map(p => ({ ...p,
    levels: levels.filter(l => l.programmeId === p.id), assessmentTypes: types.filter(t => t.programmeId === p.id),
    _count: { levels: levels.filter(l => l.programmeId === p.id).length, enrolments: programmes.filter(copy => programmeIds.resolve(copy.id) === p.id).reduce((n, copy) => n + copy._count.enrolments, 0) },
  }));
  return {
    programmes: catalogue, levels, competencies, types, programmeIds, levelIds, competencyIds, typeIds,
    level(id: string) { return levelById.get(levelIds.resolve(id)); },
    programme(id: string) { return catalogue.find(p => p.id === programmeIds.resolve(id)); },
    programmeForLevel(id: string) { return programmeIds.resolve(rawLevelById.get(levelIds.resolve(id))?.programmeId ?? ""); },
  };
}

export const getSharedCurriculum = cache(() => readSharedCurriculum());
export type SharedCurriculum = Awaited<ReturnType<typeof readSharedCurriculum>>;

export function sharedCourse<T extends { levelId?: string; level: { id?: string; name: string } }>(course: T, curriculum: SharedCurriculum): T {
  const level = curriculum.level(course.levelId ?? course.level.id ?? "");
  if (!level) return course;
  return { ...course, ...("levelId" in course ? { levelId: level.id } : {}), level: {
    ...course.level, id: level.id, name: level.name, sortOrder: level.sortOrder,
    programmeId: level.programmeId, archivedAt: level.archivedAt, programme: level.programme,
  } };
}

export function sharedPlacement<T extends { level: { id: string; name: string }; programme: { id: string; name: string }; levelId?: string; programmeId?: string }>(row: T, curriculum: SharedCurriculum): T {
  const level = curriculum.level(row.level.id);
  const programme = curriculum.programme(row.programme.id);
  return { ...row,
    ...("levelId" in row ? { levelId: level?.id ?? row.levelId } : {}),
    ...("programmeId" in row ? { programmeId: programme?.id ?? row.programmeId } : {}),
    level: level ? { ...row.level, id: level.id, name: level.name, sortOrder: level.sortOrder } : row.level,
    programme: programme ? { ...row.programme, id: programme.id, name: programme.name } : row.programme,
  };
}

export function liveSharedLevel(curriculum: SharedCurriculum, id: string) {
  const level = curriculum.level(id);
  return level && !level.archivedAt && !level.programme.archivedAt
    ? { ...level, competencies: level.competencies.filter(c => !c.archivedAt) } : null;
}
