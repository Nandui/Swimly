import { Prisma } from "@/generated/prisma/client";
import { SCHOOL_TIMEZONE } from "@/lib/format";

/** One row per weekly class occurrence. No swimmer identities leave this query.
 * Reconstruct the dated roster, retaining saved records after a swimmer moves. */
export function instructorAttendanceQuery(clubId: string, weekStart: string, weekEnd: string, now: Date) {
  return Prisma.sql`
    WITH occurrences AS (
      SELECT c.*, d.day::date AS date
      FROM "Course" c
      CROSS JOIN generate_series(${weekStart}::timestamp, ${weekEnd}::timestamp, interval '1 day') d(day)
      WHERE c."clubId" = ${clubId}
        AND c."dayOfWeek"::text = UPPER(TRIM(TO_CHAR(d.day, 'DAY')))
        AND ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date <= d.day::date
        AND (c."archivedAt" IS NULL OR ((c."archivedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date > d.day::date)
    )
    SELECT c.id AS "courseId", c.date::text AS date,
      COALESCE(c.name, l.name) AS "className", c.location,
      c."startMinutes", c."durationMinutes",
      CASE WHEN cover.id IS NOT NULL THEN cover."coverById" ELSE c."instructorId" END AS "instructorId",
      CASE WHEN cover.id IS NOT NULL THEN cover."coverByName" ELSE COALESCE(u.name, 'Unassigned') END AS "instructorName",
      COALESCE(cover."instructorName", u.name, 'Unassigned') AS "scheduledName",
      cover.id IS NOT NULL AS started,
      EXISTS (SELECT 1 FROM "ClassCancellation" x WHERE x."courseId" = c.id AND x.date = c.date) AS cancelled,
      roster.expected, roster.marked, roster.present, roster.absent, roster.late,
      COALESCE(savers.names, ARRAY[]::text[]) AS "savedBy", savers."lastSavedAt"
    FROM occurrences c
    JOIN "Level" l ON l.id = c."levelId"
    LEFT JOIN "User" u ON u.id = c."instructorId"
    LEFT JOIN "ClassCover" cover ON cover."courseId" = c.id AND cover.date = c.date
    CROSS JOIN LATERAL (
      WITH swimmers AS (
        SELECT e."studentId" FROM "Enrolment" e
        WHERE e."courseId" = c.id AND e.status <> 'WAITLISTED'
          AND e."startedOn" <= c.date
          AND (e."endedOn" IS NULL OR e."endedOn" > c.date)
          AND (e."scheduledEndOn" IS NULL OR e."scheduledEndOn" > c.date)
          AND NOT EXISTS (
            SELECT 1 FROM "AuditLog" w WHERE w.entity = 'Enrolment' AND w."entityId" = e.id AND w.action = 'waitlist'
              AND NOT EXISTS (SELECT 1 FROM "AuditLog" p WHERE p.entity = 'Enrolment' AND p."entityId" = e.id AND p.action = 'enrol' AND p."createdAt" >= w."createdAt")
          )
        UNION
        SELECT a."studentId" FROM "AttendanceRecord" a
        WHERE a."courseId" = c.id AND a.date = c.date AND a."markedAt" <= ${now.toISOString()}::timestamp
      )
      SELECT COUNT(*)::int AS expected, COUNT(a.id)::int AS marked,
        COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent,
        COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late
      FROM swimmers s LEFT JOIN "AttendanceRecord" a
        ON a."studentId" = s."studentId" AND a."courseId" = c.id AND a.date = c.date
          AND a."markedAt" <= ${now.toISOString()}::timestamp
    ) roster
    CROSS JOIN LATERAL (
      SELECT ARRAY_AGG(DISTINCT a."markedByName" ORDER BY a."markedByName") AS names,
        MAX(a."markedAt") AS "lastSavedAt"
      FROM "AttendanceRecord" a WHERE a."courseId" = c.id AND a.date = c.date
        AND a."markedAt" <= ${now.toISOString()}::timestamp
    ) savers
    ORDER BY c.date, c."startMinutes", c.id
  `;
}
