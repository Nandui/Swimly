import { Prisma } from "@/generated/prisma/client";

/* The reception reports read the desk's own swim school records here: parent app requests, billing
 * agreement checks, cancelled classes, follow-up calls and assessment bookings. Who did what comes from
 * each record's own "by" columns; the shared log is read through Core (`auditWorkload`, `auditEvents`).
 * Times leave as ISO text. No contact or medical fields leave these queries. */

function siteCourses(clubIds: string[]) {
  return Prisma.sql`SELECT id FROM "Course" WHERE "clubId" IN (${Prisma.join(clubIds)})`;
}

/** A job with a clock on it: when it arrived, when (and by whom) it was done. */
export type JobRow = {
  kind: string; siteId: string | null; arrived: string; doneAt: string | null;
  doneById: string | null; doneByName: string | null; open: boolean;
};

/** Parent app requests: a change of the swimmer's details, and a parent asking to be linked to a child.
 *  Answered ones in the window, and every one still waiting. Swimmers are shared across sites, so these
 *  belong to no site; a change request counts at a site where the swimmer has held a place. */
export function parentRequestsQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT 'parent.details' AS kind, NULL::text AS "siteId", r."createdAt"::text AS arrived, r."reviewedAt"::text AS "doneAt",
      r."reviewedById" AS "doneById", r."reviewedByName" AS "doneByName", r.status = 'PENDING' AS open
    FROM "ParentChangeRequest" r
    WHERE (r.status = 'PENDING' OR r."reviewedAt" >= ${since}::date)
      AND r."studentId" IN (SELECT e."studentId" FROM "Enrolment" e WHERE e."courseId" IN (${siteCourses(clubIds)}))
    UNION ALL
    SELECT 'parent.access', NULL, r."createdAt"::text, r."reviewedAt"::text, r."reviewedById", r."reviewedByName", r.status = 'PENDING'
    FROM "ParentAccessRequest" r
    WHERE r.status = 'PENDING' OR r."reviewedAt" >= ${since}::date
  `;
}

/** A new place waits for its Legend billing agreement to be confirmed (Done). Confirmed ones in the
 *  window, and the places still open without one. */
export function billingChecksQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT 'billing.agreement' AS kind, c."clubId" AS "siteId", e."createdAt"::text AS arrived,
      CASE WHEN e."legendAgreementStatus" = 'DONE' THEN e."legendAgreementUpdatedAt"::text END AS "doneAt",
      e."legendAgreementUpdatedById" AS "doneById", e."legendAgreementUpdatedByName" AS "doneByName",
      e."legendAgreementStatus" <> 'DONE' AS open
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    WHERE c."clubId" IN (${Prisma.join(clubIds)})
      AND ((e."legendAgreementStatus" = 'DONE' AND e."legendAgreementUpdatedAt" >= ${since}::date)
        OR (e."legendAgreementStatus" <> 'DONE' AND e.status = 'ACTIVE'))
  `;
}

/** A cancelled class waits for billing to be told. Restored classes are left out. */
export function cancellationBillingQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT 'billing.cancellation' AS kind, k."clubId" AS "siteId", k."cancelledAt"::text AS arrived, k."billingNotifiedAt"::text AS "doneAt",
      k."billingNotifiedById" AS "doneById", k."billingNotifiedByName" AS "doneByName", k."billingNotifiedAt" IS NULL AS open
    FROM "ClassCancellation" k
    WHERE k."clubId" IN (${Prisma.join(clubIds)}) AND k."restoredAt" IS NULL
      AND (k."billingNotifiedAt" IS NULL OR k."billingNotifiedAt" >= ${since}::date)
  `;
}

/** Places that are ready to move now, waiting for the desk (their start is when the teacher said so). */
export function readyNowQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT 'ready.move' AS kind, c."clubId" AS "siteId", e."readyToMoveAt"::text AS arrived, NULL::text AS "doneAt",
      NULL::text AS "doneById", NULL::text AS "doneByName", true AS open
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    WHERE c."clubId" IN (${Prisma.join(clubIds)}) AND e.status = 'ACTIVE' AND e."readyToMoveAt" IS NOT NULL
  `;
}

/** Swimmers on a waiting list now (their start is when they were added). */
export function waitingNowQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT 'waitlist.place' AS kind, c."clubId" AS "siteId", e."createdAt"::text AS arrived, NULL::text AS "doneAt",
      NULL::text AS "doneById", NULL::text AS "doneByName", true AS open
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId" JOIN "Student" s ON s.id = e."studentId"
    WHERE c."clubId" IN (${Prisma.join(clubIds)}) AND e.status = 'WAITLISTED' AND s.status = 'ACTIVE'
  `;
}

export type FollowUpRow = {
  studentId: string; actorId: string; actorName: string; clubId: string; channel: string; outcome: string;
  occurredOn: string; nextContactOn: string | null; sequence: number;
};

/** Follow-up calls and messages about enrolment logged at these sites since a date, plus each swimmer's
 *  latest one (for next contacts now overdue). */
export function followUpsQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT f."studentId", f."actorId", f."actorName", f."clubId", f.channel, f.outcome, f."occurredOn"::text AS "occurredOn",
      f."nextContactOn"::text AS "nextContactOn", f.sequence
    FROM "StudentFollowUp" f
    WHERE f."clubId" IN (${Prisma.join(clubIds)})
      AND (f."occurredOn" >= ${since}::date OR f.sequence = (SELECT MAX(g.sequence) FROM "StudentFollowUp" g WHERE g."studentId" = f."studentId"))
  `;
}

export type BookingRow = {
  bookedById: string | null; bookedByName: string; status: string; clubId: string; createdAt: string;
  sessionDate: string; firstPlace: string | null;
};

/** Assessment places booked for sessions at these sites since a date, by who booked them, and the
 *  swimmer's first class place starting from a week before the session (did they go on to start). */
export function bookingsQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT b."bookedById", b."bookedByName", b.status::text AS status, s."clubId", b."createdAt"::text AS "createdAt",
      s.date::text AS "sessionDate",
      (SELECT MIN(e."startedOn")::text FROM "Enrolment" e
        WHERE e."studentId" = b."studentId" AND e.status <> 'WAITLISTED' AND e."startedOn" >= s.date - 7) AS "firstPlace"
    FROM "AssessmentBooking" b JOIN "AssessmentSession" s ON s.id = b."sessionId"
    WHERE s."clubId" IN (${Prisma.join(clubIds)}) AND s.date >= ${since}::date
  `;
}

export type SwimmerDetailRow = { id: string; noBirthday: boolean; noPhone: boolean; noEmergency: boolean };

/** Which details new swimmers were added without: yes/no only, never the details themselves. */
export function swimmerDetailsQuery(ids: string[]) {
  if (!ids.length) return null;
  return Prisma.sql`
    SELECT s.id, s."dateOfBirth" IS NULL AS "noBirthday",
      NULLIF(TRIM(s."contactPhone"), '') IS NULL AS "noPhone",
      NULLIF(TRIM(s."emergencyPhone"), '') IS NULL AS "noEmergency"
    FROM "Student" s WHERE s.id IN (${Prisma.join(ids)})
  `;
}

export type PlaceReasonRow = { id: string; leaveReason: string | null; clubId: string };

/** The leave reason (and site) of these places, for unenrols with no reason given. */
export function placeReasonsQuery(ids: string[]) {
  if (!ids.length) return null;
  return Prisma.sql`
    SELECT e.id, e."leaveReason", c."clubId" FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId" WHERE e.id IN (${Prisma.join(ids)})
  `;
}

export type ParentLinkRow = { studentId: string; linkedOn: string };

/** When each swimmer at these sites was first linked to a parent in the app (still linked now). */
export function parentLinksQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT a."studentId", MIN(a."createdAt")::date::text AS "linkedOn"
    FROM "ParentChildAccess" a
    WHERE a."revokedAt" IS NULL AND a."studentId" IN (SELECT e."studentId" FROM "Enrolment" e WHERE e."courseId" IN (${siteCourses(clubIds)}))
    GROUP BY a."studentId"
  `;
}

export type ReadyMoveRow = { siteId: string; readyAt: string; newPlaceId: string; movedAt: string };

/** Places a teacher marked ready to move that the desk then moved (the place was moved on, keeping its
 *  ready mark), with the new place it became; who moved it is in the log against the new place. */
export function readyMovesQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT c."clubId" AS "siteId", e."readyToMoveAt"::text AS "readyAt", n.id AS "newPlaceId", n."createdAt"::text AS "movedAt"
    FROM "Enrolment" e JOIN "Course" c ON c.id = e."courseId"
    JOIN LATERAL (
      SELECT x.id, x."createdAt" FROM "Enrolment" x
      WHERE x."studentId" = e."studentId" AND x.id <> e.id AND x."createdAt" >= e."readyToMoveAt"
      ORDER BY x."createdAt" LIMIT 1
    ) n ON true
    WHERE c."clubId" IN (${Prisma.join(clubIds)}) AND e.status = 'TRANSFERRED' AND e."readyToMoveAt" IS NOT NULL
      AND n."createdAt" >= ${since}::date
  `;
}
