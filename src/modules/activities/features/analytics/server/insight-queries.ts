import { Prisma } from "@/generated/prisma/client";
import { SCHOOL_TIMEZONE } from "@/lib/format";

/* The analytics pages (Overview, Classes, Swimmers, Progression, Teachers)
 * read lean rows here and work out every figure in plain functions
 * (`insights.ts`), so the rules are tested without a database. No contact or
 * medical fields leave these queries. */

/** A booking that only ever sat on a waiting list never took a place: it is
 *  still waitlisted, or it was withdrawn while waitlisted (the audit has a
 *  waitlist entry with no later enrol). */
function tookPlace(alias: string) {
  const e = Prisma.raw(alias);
  return Prisma.sql`(${e}.status <> 'WAITLISTED' AND NOT (${e}.status = 'WITHDRAWN' AND EXISTS (
    SELECT 1 FROM "AuditLog" w WHERE w.entity = 'Enrolment' AND w."entityId" = ${e}.id AND w.action = 'waitlist'
      AND NOT EXISTS (SELECT 1 FROM "AuditLog" p WHERE p.entity = 'Enrolment' AND p."entityId" = ${e}.id AND p.action = 'enrol' AND p."createdAt" >= w."createdAt")
  )))`;
}

function siteCourses(clubIds: string[]) {
  return Prisma.sql`SELECT id FROM "Course" WHERE "clubId" IN (${Prisma.join(clubIds)})`;
}

function siteStudents(clubIds: string[]) {
  return Prisma.sql`SELECT e2."studentId" FROM "Enrolment" e2 WHERE e2."courseId" IN (${siteCourses(clubIds)})`;
}

export type PlaceRow = {
  id: string; studentId: string; courseId: string; levelId: string; programmeId: string; clubId: string;
  status: string; startedOn: string; endOn: string | null; scheduledEnd: boolean; leaveReason: string | null;
  inScope: boolean; dateOfBirth: string | null;
};

/** Every class place ever held by a swimmer who has held one at these sites,
 *  at any site, so moves between sites are not counted as leaving. `endOn`
 *  is the first day without the place: the end date, or the day after a
 *  scheduled last lesson. */
export function placesQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT e.id, e."studentId", e."courseId", e."levelId", e."programmeId", c."clubId", e.status::text AS status,
      e."startedOn"::text AS "startedOn", COALESCE(e."endedOn", e."scheduledEndOn")::text AS "endOn",
      (e."endedOn" IS NULL AND e."scheduledEndOn" IS NOT NULL) AS "scheduledEnd", e."leaveReason",
      c."clubId" IN (${Prisma.join(clubIds)}) AS "inScope", s."dateOfBirth"::text AS "dateOfBirth"
    FROM "Enrolment" e
    JOIN "Course" c ON c.id = e."courseId"
    JOIN "Student" s ON s.id = e."studentId"
    WHERE ${tookPlace("e")}
      AND e."studentId" IN (${siteStudents(clubIds)})
  `;
}

export type WaitlistRow = { id: string; studentId: string; courseId: string; levelId: string; since: string };

export function waitlistQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT e.id, e."studentId", e."courseId", e."levelId", e."startedOn"::text AS since
    FROM "Enrolment" e JOIN "Student" s ON s.id = e."studentId"
    WHERE e.status = 'WAITLISTED' AND s.status = 'ACTIVE' AND e."courseId" IN (${siteCourses(clubIds)})
  `;
}

export type CourseRow = {
  id: string; name: string | null; levelId: string; levelName: string; dayOfWeek: string; startMinutes: number;
  durationMinutes: number; capacity: number | null; location: string | null; clubId: string; siteName: string;
  instructorId: string | null; instructorName: string | null; archived: boolean;
};

/** Live classes, and classes archived since `since` so their history still reads. */
export function coursesQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT c.id, c.name, c."levelId", l.name AS "levelName", c."dayOfWeek"::text AS "dayOfWeek", c."startMinutes", c."durationMinutes",
      c.capacity, c.location, c."clubId", k.name AS "siteName", c."instructorId", u.name AS "instructorName",
      c."archivedAt" IS NOT NULL AS archived
    FROM "Course" c
    JOIN "Level" l ON l.id = c."levelId"
    JOIN "Club" k ON k.id = c."clubId"
    LEFT JOIN "User" u ON u.id = c."instructorId"
    WHERE c."clubId" IN (${Prisma.join(clubIds)})
      AND (c."archivedAt" IS NULL OR ((c."archivedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date >= ${since}::date)
  `;
}

export type LessonRow = {
  courseId: string; date: string; startMinutes: number; durationMinutes: number; cancelled: boolean; cancelReason: string | null;
  started: boolean; teacherId: string | null; teacherName: string | null;
  plannedId: string | null; plannedName: string | null; scheduledName: string | null;
  startOffset: number | null; expected: number; marked: number; present: number; late: number; absent: number;
};

/** Every weekly lesson from `from` to `to` (inclusive, past and today only),
 *  with who started it (the person who taught), who was planned, how late it
 *  was started in minutes, the dated roster size and the register. */
export function lessonsQuery(clubIds: string[], from: string, to: string) {
  return Prisma.sql`
    WITH occ AS (
      SELECT c.id AS "courseId", d.day::date AS date, c."startMinutes", c."durationMinutes", c."instructorId"
      FROM "Course" c
      CROSS JOIN generate_series(${from}::timestamp, ${to}::timestamp, interval '1 day') d(day)
      WHERE c."clubId" IN (${Prisma.join(clubIds)})
        AND c."dayOfWeek"::text = UPPER(TRIM(TO_CHAR(d.day, 'DAY')))
        AND ((c."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date <= d.day::date
        AND (c."archivedAt" IS NULL OR ((c."archivedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE})::date > d.day::date)
    ), marks AS (
      SELECT a."courseId", a.date, COUNT(*)::int AS marked,
        COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS present,
        COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS late,
        COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS absent
      FROM "AttendanceRecord" a
      WHERE a.date >= ${from}::date AND a.date <= ${to}::date AND a."courseId" IN (${siteCourses(clubIds)})
      GROUP BY a."courseId", a.date
    )
    SELECT o."courseId", o.date::text AS date, o."startMinutes", o."durationMinutes",
      (x.id IS NOT NULL) AS cancelled, x.reason AS "cancelReason",
      (cv.id IS NOT NULL) AS started, cv."coverById" AS "teacherId", cv."coverByName" AS "teacherName",
      CASE WHEN pt.id IS NOT NULL THEN pt."teacherId" ELSE o."instructorId" END AS "plannedId",
      CASE WHEN pt.id IS NOT NULL THEN pt."teacherName" ELSE u.name END AS "plannedName",
      cv."instructorName" AS "scheduledName",
      CASE WHEN cv.id IS NULL THEN NULL ELSE ROUND(EXTRACT(EPOCH FROM (
        ((cv."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${SCHOOL_TIMEZONE}) - (o.date + make_interval(mins => o."startMinutes"))
      )) / 60)::int END AS "startOffset",
      roster.expected, COALESCE(m.marked, 0) AS marked, COALESCE(m.present, 0) AS present,
      COALESCE(m.late, 0) AS late, COALESCE(m.absent, 0) AS absent
    FROM occ o
    LEFT JOIN "ClassCover" cv ON cv."courseId" = o."courseId" AND cv.date = o.date
    LEFT JOIN "ClassPlannedTeacher" pt ON pt."courseId" = o."courseId" AND pt.date = o.date
    LEFT JOIN "User" u ON u.id = o."instructorId"
    LEFT JOIN "ClassCancellation" x ON x."courseId" = o."courseId" AND x.date = o.date AND x."restoredAt" IS NULL
    LEFT JOIN marks m ON m."courseId" = o."courseId" AND m.date = o.date
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS expected FROM "Enrolment" e
      WHERE e."courseId" = o."courseId" AND e."startedOn" <= o.date
        AND (e."endedOn" IS NULL OR e."endedOn" > o.date)
        AND (e."scheduledEndOn" IS NULL OR e."scheduledEndOn" > o.date)
        AND ${tookPlace("e")}
    ) roster
    ORDER BY o.date, o."startMinutes", o."courseId"
  `;
}

export type StudentTeacherRow = { studentId: string; teacherId: string | null; teacherName: string; inPeriod: boolean; lessons: number; attended: number; lastDate: string };

/** Which teacher each swimmer was marked in front of, from the start record
 *  of the lesson (who taught it), split into this period and before it. */
export function studentTeacherQuery(clubIds: string[], since: string, from: string, to: string) {
  return Prisma.sql`
    SELECT a."studentId", cv."coverById" AS "teacherId", cv."coverByName" AS "teacherName",
      (a.date >= ${from}::date) AS "inPeriod", COUNT(*)::int AS lessons,
      COUNT(*) FILTER (WHERE a.status <> 'ABSENT')::int AS attended, MAX(a.date)::text AS "lastDate"
    FROM "AttendanceRecord" a
    JOIN "ClassCover" cv ON cv."courseId" = a."courseId" AND cv.date = a.date
    WHERE a."courseId" IN (${siteCourses(clubIds)}) AND a.date >= ${since}::date AND a.date <= ${to}::date
    GROUP BY a."studentId", cv."coverById", cv."coverByName", "inPeriod"
  `;
}

export type MarkRow = { studentId: string; courseId: string; date: string; status: "PRESENT" | "LATE" | "ABSENT"; teacherId: string | null; teacherName: string | null };

/** Each swimmer's latest eight marks at these sites, newest first, with who
 *  taught the lesson: for swimmers at risk and for a leaver's last lessons. */
export function recentMarksQuery(clubIds: string[]) {
  return Prisma.sql`
    SELECT r."studentId", r."courseId", r.date::text AS date, r.status::text AS status, cv."coverById" AS "teacherId", cv."coverByName" AS "teacherName"
    FROM (
      SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a."studentId" ORDER BY a.date DESC, a."markedAt" DESC) AS rn
      FROM "AttendanceRecord" a WHERE a."courseId" IN (${siteCourses(clubIds)})
    ) r
    LEFT JOIN "ClassCover" cv ON cv."courseId" = r."courseId" AND cv.date = r.date
    WHERE r.rn <= 8
    ORDER BY r."studentId", r.date DESC
  `;
}

export type StudentCourseRow = { studentId: string; courseId: string; marked: number; attended: number };

/** Each swimmer's register in each class over the period. */
export function studentCourseQuery(clubIds: string[], from: string, to: string) {
  return Prisma.sql`
    SELECT a."studentId", a."courseId", COUNT(*)::int AS marked, COUNT(*) FILTER (WHERE a.status <> 'ABSENT')::int AS attended
    FROM "AttendanceRecord" a
    WHERE a."courseId" IN (${siteCourses(clubIds)}) AND a.date >= ${from}::date AND a.date <= ${to}::date
    GROUP BY a."studentId", a."courseId"
  `;
}

export type CompletionRow = { studentId: string; levelId: string; completedOn: string; confirmedById: string | null; confirmedByName: string; override: boolean };

export function completionsQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT lc."studentId", lc."levelId", lc."completedOn"::text AS "completedOn", lc."confirmedById", lc."confirmedByName",
      (lc."overrideReason" IS NOT NULL) AS override
    FROM "LevelCompletion" lc
    WHERE lc."completedOn" >= ${since}::date AND lc."studentId" IN (${siteStudents(clubIds)})
  `;
}

export type TickRow = { studentId: string; competencyId: string; assessedOn: string; assessedById: string | null; assessedByName: string; courseId: string | null };

/** Skills marked achieved in classes at these sites since `since`. A skill
 *  keeps one result per swimmer, so this is the latest tick of each. */
export function ticksQuery(clubIds: string[], since: string) {
  return Prisma.sql`
    SELECT r."studentId", r."competencyId", r."assessedOn"::text AS "assessedOn", r."assessedById", r."assessedByName", r."assessedInCourseId" AS "courseId"
    FROM "CompetencyResult" r
    WHERE r.status = 'ACHIEVED' AND r."assessedOn" >= ${since}::date AND r."assessedInCourseId" IN (${siteCourses(clubIds)})
  `;
}

export type ResultRow = { studentId: string; competencyId: string; status: "ACHIEVED" | "WORKING_ON"; assessedOn: Date; updatedAt: Date };

/** Every skill result of the given swimmers, for their progress at their current level. */
export function resultsQuery(studentIds: string[]) {
  if (studentIds.length === 0) return null;
  return Prisma.sql`
    SELECT r."studentId", r."competencyId", r.status::text AS status, r."assessedOn", r."updatedAt"
    FROM "CompetencyResult" r WHERE r."studentId" IN (${Prisma.join(studentIds)})
  `;
}

export type AssessmentRow = { sessionId: string; date: string; sessionCancelled: boolean; status: string | null; studentId: string | null; outcomeLevelId: string | null };

/** Assessment sessions and their bookings (one row per booking, or one empty row for a session with none). */
export function assessmentsQuery(clubIds: string[], since: string, to: string) {
  return Prisma.sql`
    SELECT s.id AS "sessionId", s.date::text AS date, (s."cancelledAt" IS NOT NULL) AS "sessionCancelled",
      b.status::text AS status, b."studentId", b."outcomeLevelId"
    FROM "AssessmentSession" s
    LEFT JOIN "AssessmentBooking" b ON b."sessionId" = s.id
    WHERE s."clubId" IN (${Prisma.join(clubIds)}) AND s.date >= ${since}::date AND s.date <= ${to}::date
  `;
}
