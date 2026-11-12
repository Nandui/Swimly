import { curriculumIndex, type Curriculum, type Dataset } from "@/modules/activities/features/analytics/server/insights";

/** The programmes a report can be narrowed to: the shared, live ones, in their usual order. */
export function programmeOptions(curriculum: Pick<Curriculum, "programmes">) {
  return curriculum.programmes.filter(p => !p.sharedWithId && !p.archivedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(p => ({ id: p.id, name: p.name }));
}

/** Keep only the rows of one programme (owner request, 16 October 2026: filter "all that"). A place,
 *  waiting list entry, class or pass belongs to the programme of its level; lessons, registers and
 *  marks to their class's. A move into another programme reads as leaving this one. Assessment
 *  sessions are not tied to a programme, so only bookings placed in another programme are dropped. */
export function forProgramme<T extends Omit<Dataset, "period" | "minutes" | "lessons"> & { lessons: { courseId: string }[] }>(ds: T, programmeId: string | null): T {
  if (!programmeId) return ds;
  const index = curriculumIndex(ds.curriculum);
  const inProgramme = (levelId: string | null) => levelId !== null && index.programmeOf(levelId)?.id === programmeId;
  const levelOfSkill = new Map(ds.curriculum.competencies.map(c => [c.id, c.levelId]));
  const skillIn = (id: string) => inProgramme(levelOfSkill.get(id) ?? null);
  const courses = ds.courses.filter(c => inProgramme(c.levelId));
  const courseIds = new Set(courses.map(c => c.id));
  const places = ds.places.filter(p => inProgramme(p.levelId));
  const swimmers = new Set(places.map(p => p.studentId));
  return {
    ...ds, courses, places,
    waitlist: ds.waitlist.filter(w => inProgramme(w.levelId)),
    lessons: ds.lessons.filter(l => courseIds.has(l.courseId)),
    marks: ds.marks.filter(m => courseIds.has(m.courseId)),
    studentCourses: ds.studentCourses.filter(s => courseIds.has(s.courseId)),
    studentTeachers: ds.studentTeachers.filter(s => swimmers.has(s.studentId)),
    completions: ds.completions.filter(c => inProgramme(c.levelId)),
    ticks: ds.ticks.filter(t => skillIn(t.competencyId)),
    results: ds.results.filter(r => skillIn(r.competencyId)),
    assessments: ds.assessments.filter(a => a.outcomeLevelId === null || inProgramme(a.outcomeLevelId)),
  };
}
