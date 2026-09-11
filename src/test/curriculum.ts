/** Synthetic catalogue rows shaped like the shared reader's Prisma select. */
export function curriculumProgramme(id = "programme", levelIds = ["entry", "next"]) {
  return {
    id, sharedWithId: null as string | null, clubId: "club", club: { id: "club", name: "Site A" },
    name: id === "programme" ? "Learn to Swim" : id, description: null, sortOrder: 0,
    archivedAt: null as Date | null, imageVersion: null as string | null, _count: { enrolments: 0 },
    levels: levelIds.map((levelId, i) => ({ id: levelId, sharedWithId: null as string | null, programmeId: id,
      name: levelId === "entry" || levelId === "level" ? "Entry" : levelId === "next" ? "Next" : levelId,
      description: null, sortOrder: i, archivedAt: null as Date | null, imageVersion: null as string | null,
      _count: { courses: 0, enrolments: 0 },
      competencies: [{ id: `${levelId}-skill`, sharedWithId: null as string | null, levelId, name: "Float", description: null,
        sortOrder: 0, archivedAt: null as Date | null, _count: { results: 0 } }],
    })),
    assessmentTypes: [{ id: `${id}-type`, sharedWithId: null as string | null, programmeId: id, name: "Placement",
      description: null, sortOrder: 0, archivedAt: null as Date | null, _count: { sessions: 0 } }],
  };
}

export function sharedCurriculumRows() {
  const original = curriculumProgramme();
  const copy = curriculumProgramme("programme-b", ["entry-b", "next-b"]);
  copy.sharedWithId = original.id;
  copy.clubId = "other"; copy.club = { id: "other", name: "Site B" };
  copy.levels.forEach((level, i) => {
    level.sharedWithId = original.levels[i].id;
    level.competencies[0].sharedWithId = original.levels[i].competencies[0].id;
  });
  copy.assessmentTypes[0].sharedWithId = original.assessmentTypes[0].id;
  return [original, copy];
}
