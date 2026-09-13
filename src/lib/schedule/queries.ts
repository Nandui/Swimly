import { Prisma } from "@/generated/prisma/client";

/** Count places covering the selected day, including bookings that have since
 * ended. Never count a waitlist-only booking as an occupied class place. */
export function schedulePlacesQuery(clubId: string, iso: string) {
  return Prisma.sql`
    SELECT e."courseId", COUNT(*)::int AS enrolled
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    WHERE c."clubId" = ${clubId} AND c."archivedAt" IS NULL
      AND e.status IN ('ACTIVE', 'COMPLETED', 'WITHDRAWN', 'TRANSFERRED')
      AND e."startedOn" <= ${iso}::date
      AND (e."endedOn" IS NULL OR e."endedOn" > ${iso}::date)
      AND (e."scheduledEndOn" IS NULL OR e."scheduledEndOn" > ${iso}::date)
      AND NOT EXISTS (
        SELECT 1 FROM "AuditLog" w
        WHERE w.entity = 'Enrolment' AND w."entityId" = e.id AND w.action = 'waitlist'
          AND NOT EXISTS (
            SELECT 1 FROM "AuditLog" p
            WHERE p.entity = 'Enrolment' AND p."entityId" = e.id AND p.action = 'enrol'
              AND p."createdAt" >= w."createdAt"
          )
      )
    GROUP BY e."courseId"
  `;
}
