import { Prisma } from "@/generated/prisma/client";
import { SCHOOL_TIMEZONE } from "@/lib/format";

/** Only identifiers needed for distinct counts; never names or contact data. */
export function currentEnrolmentsQuery(clubIds: string[], date: string) {
  return Prisma.sql`
    SELECT e."studentId", c."levelId"
    FROM "Enrolment" e
    JOIN "Course" c ON c.id = e."courseId"
    JOIN "Student" s ON s.id = e."studentId"
    WHERE c."clubId" IN (${Prisma.join(clubIds)}) AND c."archivedAt" IS NULL
      AND e.status = 'ACTIVE' AND s.status = 'ACTIVE'
      AND e."startedOn" <= ${date}::date
      AND (e."endedOn" IS NULL OR e."endedOn" > ${date}::date)
      AND (e."scheduledEndOn" IS NULL OR e."scheduledEndOn" > ${date}::date)
  `;
}

/** Count each live weekly class once, including empty classes. Do not join
 *  enrolments here: that would multiply capacity by the size of the roster.
 *  Any uncapped class makes that level's total capacity uncapped. */
export function levelCapacityQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT c."levelId", COUNT(*)::int AS classes,
      CASE WHEN COUNT(*) FILTER (WHERE c.capacity IS NULL) > 0 THEN NULL
        ELSE SUM(c.capacity)::int END AS capacity
    FROM "Course" c
    WHERE c."clubId" IN (${Prisma.join(clubIds)}) AND c."archivedAt" IS NULL
    GROUP BY c."levelId"
  `;
}

/** Audit timestamps are UTC timestamps without timezone. Bucket and bound
 *  them in the school's calendar, including DST and the unfinished today. */
export function activityQuery(clubIds: string[], weekStart: string, now: Date) {
  return Prisma.sql`
    SELECT ((a."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date::text AS day,
      COUNT(*) FILTER (WHERE a.action = 'enrol')::int AS enrolled,
      COUNT(*) FILTER (WHERE a.action = 'withdraw')::int AS withdrawn
    FROM "AuditLog" a
    LEFT JOIN "Enrolment" e ON e.id = a."entityId"
    LEFT JOIN "Course" c ON c.id = e."courseId"
    WHERE a.entity = 'Enrolment' AND a.action IN ('enrol', 'withdraw')
      AND COALESCE(a."clubId", c."clubId") IN (${Prisma.join(clubIds)})
      AND a."createdAt" >= ((${weekStart}::date::timestamp AT TIME ZONE ${SCHOOL_TIMEZONE}) AT TIME ZONE 'UTC')
      AND a."createdAt" <= ${now.toISOString()}::timestamp
      AND (a.action = 'enrol' OR NOT EXISTS (
        SELECT 1 FROM "AuditLog" w
        WHERE w.entity = 'Enrolment' AND w."entityId" = a."entityId"
          AND w.action = 'waitlist' AND w."createdAt" <= a."createdAt"
          AND NOT EXISTS (
            SELECT 1 FROM "AuditLog" p
            WHERE p.entity = 'Enrolment' AND p."entityId" = w."entityId"
              AND p.action = 'enrol' AND p."createdAt" >= w."createdAt"
              AND p."createdAt" <= a."createdAt"
          )
      ))
    GROUP BY day ORDER BY day
  `;
}

export function cancellationsQuery(clubIds: string[], monthStart: string, nextMonth: string) {
  return Prisma.sql`
    WITH cancelled AS (
      SELECT id, "billingNotifiedAt" FROM "ClassCancellation"
      WHERE "clubId" IN (${Prisma.join(clubIds)})
        AND date >= ${monthStart}::date AND date < ${nextMonth}::date
    )
    SELECT COUNT(*)::int AS sessions,
      COUNT(*) FILTER (WHERE "billingNotifiedAt" IS NULL)::int AS pending,
      COUNT(*) FILTER (WHERE "billingNotifiedAt" IS NOT NULL)::int AS notified,
      (SELECT COUNT(*)::int FROM "CancelledClassSwimmer" s
        JOIN cancelled c ON c.id = s."cancellationId") AS "affectedPlaces"
    FROM cancelled
  `;
}
