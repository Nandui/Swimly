import { Prisma } from "@/generated/prisma/client";
import { AuthorizationError, can, canSee, requireSession } from "@/lib/authz";
import { getSharedCurriculum } from "@/lib/curriculum/data/shared";
import { isDateOnly } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { evidenceSchema, historyQuerySchema, type HistoryEvent, type HistoryPage, type HistoryQuery } from "@/lib/students/history";

type HistoryRow = { id: string; at: Date; kind: HistoryEvent["kind"]; courseId: string | null; programmeId: string | null; payload: Record<string, unknown> };
const text = (value: unknown) => typeof value === "string" ? value : null;

/** Parameterised union gives one stable cursor across audits and legacy record snapshots.
 * A child is matched by ID/relations, never by a name inside an audit summary.
 * Audit permission is checked here, including calls from a history dialog. */
export async function getSwimmerHistory(studentId: string, query: HistoryQuery = {}): Promise<HistoryPage> {
  const session = await requireSession();
  if (!canSee(session, "students")) throw new AuthorizationError("Swimmer profiles are not available to this account.");
  const canAudit = can(session, "activity.view");
  const validated = historyQuerySchema.safeParse(query);
  if (typeof studentId !== "string" || !studentId || studentId.length > 100 || !validated.success) return { events: [], next: null, canAudit };
  const input = validated.data;
  const curriculum = await getSharedCurriculum();
  const competencyLinks = JSON.stringify(Object.fromEntries(curriculum.competencies.flatMap(c => curriculum.competencyIds.variants(c.id).map(id => [id, c.id]))));
  const levelLinks = JSON.stringify(Object.fromEntries(curriculum.levels.flatMap(l => curriculum.levelIds.variants(l.id).map(id => [id, l.id]))));
  const competencyIds = input.competencyId ? curriculum.competencyIds.variants(input.competencyId).slice(0, 100) : [];
  const programmeIds = input.programmeId ? curriculum.programmeIds.variants(input.programmeId).slice(0, 100) : [];
  const conditions: Prisma.Sql[] = [];
  if (input.kind && input.kind !== "all") conditions.push(Prisma.sql`h.kind = ${input.kind}`);
  if (input.courseId) conditions.push(Prisma.sql`h."courseId" = ${input.courseId.slice(0, 100)}`);
  if (programmeIds.length) conditions.push(Prisma.sql`h."programmeId" IN (${Prisma.join(programmeIds)})`);
  if (competencyIds.length) conditions.push(Prisma.sql`(h.payload->>'competencyId' IN (${Prisma.join(competencyIds)}) OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h.payload->'details'->'changes') = 'array' THEN h.payload->'details'->'changes' ELSE '[]'::jsonb END) change WHERE change->>'competencyId' IN (${Prisma.join(competencyIds)})))`);
  if (isDateOnly(input.from)) conditions.push(Prisma.sql`COALESCE(h.payload->>'date', to_char(h.at, 'YYYY-MM-DD')) >= ${input.from}`);
  if (isDateOnly(input.to)) conditions.push(Prisma.sql`COALESCE(h.payload->>'date', to_char(h.at, 'YYYY-MM-DD')) <= ${input.to}`);
  if (input.q?.trim()) conditions.push(Prisma.sql`strpos(lower(h.payload::text), lower(${input.q.trim().slice(0, 160)})) > 0`);
  if (input.cursor && Number.isFinite(Date.parse(input.cursor.at)) && input.cursor.id.length <= 150) conditions.push(Prisma.sql`(h.at, h.id) < (${new Date(input.cursor.at)}, ${input.cursor.id})`);
  const where = conditions.length ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
  const rows = await prisma.$queryRaw<HistoryRow[]>(Prisma.sql`
    WITH links AS (SELECT ${competencyLinks}::jsonb AS skills, ${levelLinks}::jsonb AS levels), own_audits AS (
      SELECT a.*, e."courseId" AS "enrolmentCourseId", e."levelId" AS "enrolmentLevelId"
      FROM "AuditLog" a
      LEFT JOIN "Enrolment" e ON a.entity = 'Enrolment' AND a."entityId" = e.id AND e."studentId" = ${studentId}
      LEFT JOIN "AssessmentBooking" b ON a.entity = 'AssessmentBooking' AND a."entityId" = b.id AND b."studentId" = ${studentId}
      WHERE ${canAudit} AND ((a.entity = 'Student' AND a."entityId" = ${studentId}) OR e.id IS NOT NULL OR b.id IS NOT NULL)
    ), latest_marks AS (
      SELECT DISTINCT ON (COALESCE(links.skills->>r."competencyId",r."competencyId")) r.*,
        COALESCE(links.skills->>r."competencyId",r."competencyId") AS "sharedCompetencyId"
      FROM "CompetencyResult" r CROSS JOIN links WHERE r."studentId" = ${studentId}
      ORDER BY COALESCE(links.skills->>r."competencyId",r."competencyId"), r."updatedAt" DESC, r."competencyId" ASC
    ), latest_completions AS (
      SELECT DISTINCT ON (COALESCE(links.levels->>r."levelId",r."levelId")) r.*,
        COALESCE(links.levels->>r."levelId",r."levelId") AS "sharedLevelId"
      FROM "LevelCompletion" r CROSS JOIN links WHERE r."studentId" = ${studentId}
      ORDER BY COALESCE(links.levels->>r."levelId",r."levelId"), r."completedOn" DESC, r.id DESC
    ), history AS (
      SELECT 'audit:' || a.id AS id, a."createdAt" AS at,
        CASE WHEN a.details->>'kind' = 'attendance' THEN 'attendance' WHEN a.action = 'assess' THEN 'competencies'
          WHEN a.action IN ('complete-level','revoke-level') THEN 'completion' WHEN a.entity = 'Enrolment' THEN 'enrolment'
          WHEN a.entity = 'AssessmentBooking' THEN 'assessment' ELSE 'profile' END AS kind,
        COALESCE(a.details->>'courseId', a."enrolmentCourseId") AS "courseId", a."programmeId",
        jsonb_build_object('title', a.summary, 'actor', a."actorName", 'date', COALESCE(a.details->>'date', to_char(a."createdAt", 'YYYY-MM-DD')),
          'details', a.details, 'levelId', COALESCE(a.details->>'levelId', a."enrolmentLevelId"), 'site', club.name, 'snapshot', false) AS payload
      FROM own_audits a LEFT JOIN "Club" club ON club.id = a."clubId"
      UNION ALL
      SELECT 'attendance:' || r.id, r."markedAt", 'attendance', r."courseId", l."programmeId",
        jsonb_build_object('title', 'Attendance record', 'actor', r."markedByName", 'date', to_char(r.date, 'YYYY-MM-DD'), 'site', club.name,
          'className', COALESCE(c.name,l.name), 'levelId', c."levelId", 'snapshot', true,
          'details', jsonb_build_object('version',1,'kind','attendance','date',to_char(r.date,'YYYY-MM-DD'),'after',r.status,'note',r.note))
      FROM "AttendanceRecord" r JOIN "Course" c ON c.id = r."courseId" JOIN "Level" l ON l.id = c."levelId" JOIN "Club" club ON club.id = c."clubId"
      WHERE r."studentId" = ${studentId} AND NOT EXISTS (SELECT 1 FROM own_audits a WHERE a.details->>'kind' = 'attendance' AND a.details->>'courseId' = r."courseId" AND a.details->>'date' = to_char(r.date,'YYYY-MM-DD'))
      UNION ALL
      SELECT 'competency:' || r.id, r."updatedAt", 'competencies', r."assessedInCourseId", l."programmeId",
        jsonb_build_object('title', cp.name, 'actor',r."assessedByName", 'date',to_char(r."assessedOn",'YYYY-MM-DD'),'levelId',l.id,'competencyId',cp.id,'snapshot',true,
          'details',jsonb_build_object('version',1,'kind','competencies','after',r.status),'site',club.name)
      FROM latest_marks r JOIN "Competency" cp ON cp.id = r."sharedCompetencyId" JOIN "Level" l ON l.id = cp."levelId"
      LEFT JOIN "Course" c ON c.id = r."assessedInCourseId" LEFT JOIN "Club" club ON club.id = c."clubId"
      WHERE NOT EXISTS (SELECT 1 FROM own_audits a CROSS JOIN links,
        LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(a.details->'changes') = 'array' THEN a.details->'changes' ELSE '[]'::jsonb END) change
        WHERE a.action = 'assess' AND COALESCE(links.skills->>(change->>'competencyId'),change->>'competencyId') = r."sharedCompetencyId")
      UNION ALL
      SELECT 'completion:' || r.id, r."createdAt", 'completion', NULL, r."programmeId",
        jsonb_build_object('title','Level completed · ' || l.name,'actor',r."confirmedByName",'date',to_char(r."completedOn",'YYYY-MM-DD'),
          'levelId',r."sharedLevelId",'snapshot',true,'details',jsonb_build_object('version',1,'kind','completion','note',r.note))
      FROM latest_completions r JOIN "Level" l ON l.id = r."sharedLevelId"
      WHERE NOT EXISTS (SELECT 1 FROM own_audits a CROSS JOIN links WHERE a.action = 'complete-level'
        AND COALESCE(links.levels->>(a.details->>'levelId'),a.details->>'levelId') = r."sharedLevelId")
      UNION ALL
      SELECT 'enrolment:' || e.id, e."startedOn"::timestamp, 'enrolment', e."courseId", e."programmeId",
        jsonb_build_object('title','Enrolment record · ' || l.name,'date',to_char(e."startedOn",'YYYY-MM-DD'),'site',club.name,'levelId',e."levelId",'snapshot',true)
      FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId" JOIN "Level" l ON l.id = e."levelId" JOIN "Club" club ON club.id = c."clubId"
      WHERE e."studentId" = ${studentId} AND NOT EXISTS (SELECT 1 FROM own_audits a WHERE a.entity = 'Enrolment' AND a."entityId" = e.id)
      UNION ALL
      SELECT 'assessment:' || b.id, COALESCE(b."assessedOn", s.date)::timestamp, 'assessment', NULL, s."programmeId",
        jsonb_build_object('title', CASE WHEN b."outcomeLevelId" IS NOT NULL THEN 'Assessment placement · ' || l.name ELSE 'Assessment booking · ' || b.status::text END,
          'actor',b."assessedByName",'date',to_char(s.date,'YYYY-MM-DD'),'site',club.name,'levelId',b."outcomeLevelId",'snapshot',true)
      FROM "AssessmentBooking" b JOIN "AssessmentSession" s ON s.id = b."sessionId" JOIN "Club" club ON club.id = s."clubId" LEFT JOIN "Level" l ON l.id = b."outcomeLevelId"
      WHERE b."studentId" = ${studentId} AND NOT EXISTS (SELECT 1 FROM own_audits a WHERE a.entity = 'AssessmentBooking' AND a."entityId" = b.id)
    ) SELECT * FROM history h ${where} ORDER BY h.at DESC, h.id DESC LIMIT 31
  `);
  const page = rows.slice(0, 30);
  const events = page.map((row): HistoryEvent => {
    const evidence = evidenceSchema.safeParse(row.payload.details);
    return { id: row.id, at: row.at.toISOString(), date: text(row.payload.date) ?? row.at.toISOString().slice(0, 10), kind: row.kind,
      courseId: row.courseId, programmeId: row.programmeId ? curriculum.programmeIds.resolve(row.programmeId) : null,
      levelId: text(row.payload.levelId) ? curriculum.levelIds.resolve(String(row.payload.levelId)) : null,
      title: text(row.payload.title) ?? "Activity recorded", actor: text(row.payload.actor), site: text(row.payload.site), className: text(row.payload.className),
      snapshot: row.payload.snapshot === true, evidence: evidence.success ? { ...evidence.data,
        ...(evidence.data.changes ? { changes: evidence.data.changes.filter(c => !competencyIds.length || competencyIds.includes(c.competencyId)).map(c => ({ ...c, competencyId: curriculum.competencyIds.resolve(c.competencyId) })) } : {}) } : null };
  });
  const last = events.at(-1);
  return { events, next: rows.length > 30 && last ? { at: last.at, id: last.id } : null, canAudit };
}
