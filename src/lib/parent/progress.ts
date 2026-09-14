import type { ParentAccount, Prisma } from "@/generated/prisma/client";
import { readSharedCurriculum, type SharedCurriculum } from "@/lib/curriculum/data/shared";
import { requireChild } from "@/lib/parent/children";
import { parseDateOnly, today } from "@/lib/format";
import { PARENT_TIMEZONE } from "@/lib/parent/time";

export type ReleasedEvent = { id: bigint; kind: string; subjectId: string; value: Prisma.JsonValue; recordedAt: Date };

export async function releasedEvents(tx: Prisma.TransactionClient, childId: string, now = new Date()) {
  // Resolve each raw subject first. Clearing an alias must not erase a mark on
  // another alias; canonicalisation follows the existing shared-curriculum rule.
  return tx.$queryRaw<ReleasedEvent[]>`
    SELECT DISTINCT ON (kind,"subjectId") id,kind,"subjectId",value,"recordedAt"
    FROM "ParentProgressEvent" WHERE "studentId"=${childId} AND "releaseAt" <= ${now}
    ORDER BY kind,"subjectId","recordedAt" DESC,id DESC`;
}

function object(value: Prisma.JsonValue): Prisma.JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function progressDto(events: ReleasedEvent[], curriculum: SharedCurriculum, currentLevelIds: string[]) {
  const marks = new Map<string, ReleasedEvent>(), completions = new Map<string, ReleasedEvent>();
  for (const event of [...events].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime() || (a.id < b.id ? -1 : 1))) {
    if (!event.value) continue;
    if (event.kind === "competency") marks.set(curriculum.competencyIds.resolve(event.subjectId), event);
    if (event.kind === "completion") completions.set(curriculum.levelIds.resolve(event.subjectId), event);
  }
  const current = new Set(currentLevelIds.map(id => curriculum.levelIds.resolve(id)));
  const relevant = new Set([...current, ...completions.keys()]);
  for (const competency of curriculum.competencies) if (marks.has(competency.id)) relevant.add(competency.levelId);
  const assessmentOutcomes = events.filter(e => e.kind === "assessment" && e.value).map(event => {
    const value = object(event.value), level = curriculum.level(String(value.levelId));
    if (level) relevant.add(level.id);
    return { bookingId: event.subjectId, level: level ? { id: level.id, name: level.name } : null, assessedOn: value.assessedOn ?? null };
  });
  const programmes = curriculum.programmes.filter(p => p.levels.some(l => relevant.has(l.id))).map(programme => ({
    id: programme.id, name: programme.name,
    levels: programme.levels.filter(l => !l.archivedAt || relevant.has(l.id)).map(level => {
      const competencies = level.competencies.filter(c => !c.archivedAt || marks.has(c.id)).map(competency => {
        const value = object(marks.get(competency.id)?.value ?? null);
        return { id: competency.id, name: competency.name, description: competency.description,
          status: value.status === "ACHIEVED" || value.status === "WORKING_ON" ? value.status : "NOT_ASSESSED", assessedOn: value.assessedOn ?? null };
      });
      const completion = completions.get(level.id);
      const value = object(completion?.value ?? null);
      return { id: level.id, name: level.name, description: level.description, current: current.has(level.id),
        achieved: competencies.filter(c => c.status === "ACHIEVED").length, total: competencies.length,
        completion: completion ? { completedOn: value.completedOn, achieved: value.achieved, total: value.total } : null, competencies };
    }),
  }));
  return { timezone: PARENT_TIMEZONE, programmes, assessmentOutcomes };
}

export async function childProgress(tx: Prisma.TransactionClient, parent: ParentAccount, childId: string) {
  await requireChild(tx, parent, childId);
  const now = new Date(), day = parseDateOnly(today(now));
  const [events, curriculum, enrolments] = await Promise.all([
    releasedEvents(tx, childId, now), readSharedCurriculum(tx),
    tx.enrolment.findMany({ where: { studentId: childId, status: "ACTIVE", startedOn: { lte: day },
      AND: [{ OR: [{ endedOn: null }, { endedOn: { gt: day } }] }, { OR: [{ scheduledEndOn: null }, { scheduledEndOn: { gt: day } }] }] }, select: { levelId: true } }),
  ]);
  return { childId, ...progressDto(events, curriculum, enrolments.map(e => e.levelId)) };
}
