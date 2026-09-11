import { requireSession } from "@/lib/authz";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";

/** One shared catalogue; original site copies remain addressable by ID. */
export async function getProgrammes(includeArchived = false) {
  await requireSession();
  return (await getSharedCurriculum()).programmes.filter(p => includeArchived || !p.archivedAt);
}
export type ProgrammeRow = Awaited<ReturnType<typeof getProgrammes>>[number];

export async function getProgramme(id: string, includeArchived = false) {
  await requireSession();
  const programme = (await getSharedCurriculum()).programme(id);
  return programme ? { ...programme, levels: programme.levels.filter(l => includeArchived || !l.archivedAt).map(l => ({
    ...l, competencies: l.competencies.filter(c => includeArchived || !c.archivedAt),
  })) } : null;
}
export type ProgrammeDetail = NonNullable<Awaited<ReturnType<typeof getProgramme>>>;
export type LevelDetail = ProgrammeDetail["levels"][number];
export type CompetencyDetail = LevelDetail["competencies"][number];

export async function getCurriculumSummary() {
  await requireSession();
  const curriculum = await getSharedCurriculum();
  const levels = curriculum.levels.filter(l => !l.archivedAt && !l.programme.archivedAt);
  return { programmes: curriculum.programmes.filter(p => !p.archivedAt).length,
    levels: levels.length, competencies: levels.reduce((n, l) => n + l.competencies.filter(c => !c.archivedAt).length, 0) };
}

export async function getLevelOptions() {
  await requireSession();
  return (await getSharedCurriculum()).levels.filter(l => !l.archivedAt && !l.programme.archivedAt)
    .sort((a, b) => a.programme.sortOrder - b.programme.sortOrder || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(l => ({ id: l.id, name: l.name, sortOrder: l.sortOrder, programme: { id: l.programme.id, name: l.programme.name, sortOrder: l.programme.sortOrder } }));
}
export type LevelOption = Awaited<ReturnType<typeof getLevelOptions>>[number];
