-- Clubs: one app, several sites.
--
-- Everything the app held before this belongs to the club it was built for,
-- LeisureWorld Bishopstown, so every new "clubId" column is added with that as
-- its default and the default is dropped straight after: the backfill happens
-- once, here, and a row made from now on has to say which club it is for.
-- A second club, LeisureWorld Churchfield, is created empty.

-- CreateTable
CREATE TABLE "Club" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Club_name_key" ON "Club"("name");

-- CreateIndex
CREATE INDEX "Club_sortOrder_idx" ON "Club"("sortOrder");

-- The two sites. Readable ids on purpose: this migration and the scripts
-- from before clubs existed both name the first one.
INSERT INTO "Club" ("id", "name", "sortOrder", "updatedAt") VALUES
    ('club_bishopstown', 'LeisureWorld Bishopstown', 0, CURRENT_TIMESTAMP),
    ('club_churchfield', 'LeisureWorld Churchfield', 1, CURRENT_TIMESTAMP);

-- Programme: unique per club rather than across them.
ALTER TABLE "Programme" ADD COLUMN "clubId" TEXT NOT NULL DEFAULT 'club_bishopstown';
ALTER TABLE "Programme" ALTER COLUMN "clubId" DROP DEFAULT;

DROP INDEX "Programme_name_key";
DROP INDEX "Programme_sortOrder_idx";

CREATE UNIQUE INDEX "Programme_clubId_name_key" ON "Programme"("clubId", "name");
CREATE INDEX "Programme_clubId_sortOrder_idx" ON "Programme"("clubId", "sortOrder");

ALTER TABLE "Programme"
    ADD CONSTRAINT "Programme_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Student
ALTER TABLE "Student" ADD COLUMN "clubId" TEXT NOT NULL DEFAULT 'club_bishopstown';
ALTER TABLE "Student" ALTER COLUMN "clubId" DROP DEFAULT;

DROP INDEX "Student_status_lastName_firstName_idx";
CREATE INDEX "Student_clubId_status_lastName_firstName_idx" ON "Student"("clubId", "status", "lastName", "firstName");

ALTER TABLE "Student"
    ADD CONSTRAINT "Student_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Course
ALTER TABLE "Course" ADD COLUMN "clubId" TEXT NOT NULL DEFAULT 'club_bishopstown';
ALTER TABLE "Course" ALTER COLUMN "clubId" DROP DEFAULT;

DROP INDEX "Course_dayOfWeek_startMinutes_idx";
CREATE INDEX "Course_clubId_dayOfWeek_startMinutes_idx" ON "Course"("clubId", "dayOfWeek", "startMinutes");

ALTER TABLE "Course"
    ADD CONSTRAINT "Course_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AssessmentSession
ALTER TABLE "AssessmentSession" ADD COLUMN "clubId" TEXT NOT NULL DEFAULT 'club_bishopstown';
ALTER TABLE "AssessmentSession" ALTER COLUMN "clubId" DROP DEFAULT;

DROP INDEX "AssessmentSession_date_startMinutes_idx";
CREATE INDEX "AssessmentSession_clubId_date_startMinutes_idx" ON "AssessmentSession"("clubId", "date", "startMinutes");

ALTER TABLE "AssessmentSession"
    ADD CONSTRAINT "AssessmentSession_clubId_fkey"
    FOREIGN KEY ("clubId") REFERENCES "Club"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AuditLog: a plain nullable column, like "programmeId", so the log survives
-- the club. Everything already logged happened at Bishopstown, except what
-- the clubs share.
ALTER TABLE "AuditLog" ADD COLUMN "clubId" TEXT;
CREATE INDEX "AuditLog_clubId_createdAt_idx" ON "AuditLog"("clubId", "createdAt");

UPDATE "AuditLog" SET "clubId" = 'club_bishopstown'
    WHERE "entity" NOT IN ('User', 'StaffRole');

-- The new permission goes to every role that can already hand out
-- permissions: they could give it to themselves, so withholding it would only
-- add a step.
UPDATE "StaffRole"
    SET "permissions" = array_append("permissions", 'clubs.manage')
    WHERE 'roles.manage' = ANY("permissions")
      AND NOT ('clubs.manage' = ANY("permissions"));

-- Every mutation is audited, migrations included.
INSERT INTO "AuditLog" ("id", "actorName", "action", "entity", "entityId", "clubId", "summary") VALUES
    ('audit_club_bishopstown', 'Migration', 'create', 'Club', 'club_bishopstown', 'club_bishopstown',
     'Created club LeisureWorld Bishopstown and placed every existing programme, class, swimmer and assessment session in it'),
    ('audit_club_churchfield', 'Migration', 'create', 'Club', 'club_churchfield', 'club_churchfield',
     'Created club LeisureWorld Churchfield, empty');
