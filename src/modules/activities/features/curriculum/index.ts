/** Programmes, levels, competencies and their images. Entry for the module and its routes. */
export { CurriculumImage } from "@/modules/activities/features/curriculum/components/curriculum-image";
export {
  AddCompetency, AddLevel, ArchiveCompetency, ArchiveLevel, EditCompetency, EditLevel, MoveCompetency, MoveLevel,
} from "@/modules/activities/features/curriculum/components/level-actions";
export { AddProgramme, ArchiveProgramme, EditProgramme, MoveProgramme } from "@/modules/activities/features/curriculum/components/programme-actions";
export { getAssessmentTypes } from "@/modules/activities/shared/assessments/data/assessments";
export { competencyCountLabel, levelCountLabel } from "@/modules/activities/shared/curriculum/constants";
export { type CompetencyDetail, getCurriculumSummary, getProgramme, getProgrammes, type LevelDetail } from "@/modules/activities/shared/curriculum/data/curriculum";
