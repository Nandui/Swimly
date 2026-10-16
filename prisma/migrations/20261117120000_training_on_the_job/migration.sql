-- Training e-learning, phase 5 (owner request, 15 October 2026; docs/training.md):
-- skills on the job. Additive only: new training_* tables and nullable columns.
-- Existing courses and assignments are untouched.

-- The steps a trainer watches for at a practical sign-off, and what they saw
ALTER TABLE "TrainingCourse" ADD COLUMN "observation" JSONB;
ALTER TABLE "TrainingAssignment" ADD COLUMN "observation" JSONB;
-- The learning path an assignment came from, if any
ALTER TABLE "TrainingAssignment" ADD COLUMN "pathEnrolmentId" TEXT;

-- Photos taken as evidence at a practical sign-off: a person's record, not course material
CREATE TABLE "training_evidence" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "addedById" TEXT,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_evidence_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_evidence_assignmentId_idx" ON "training_evidence"("assignmentId");
ALTER TABLE "training_evidence" ADD CONSTRAINT "training_evidence_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "TrainingAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Learning paths: courses in order, such as a new lifeguard's first month
CREATE TABLE "training_paths" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_paths_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "training_paths_orgId_title_key" ON "training_paths"("orgId", "title");

CREATE TABLE "training_path_steps" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "dueDays" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "training_path_steps_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_path_steps_dueDays_check" CHECK ("dueDays" BETWEEN 0 AND 365)
);
CREATE UNIQUE INDEX "training_path_steps_pathId_courseId_key" ON "training_path_steps"("pathId", "courseId");
ALTER TABLE "training_path_steps" ADD CONSTRAINT "training_path_steps_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "training_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_path_steps" ADD CONSTRAINT "training_path_steps_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "training_path_enrolments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "enrolledById" TEXT,
    "enrolledByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "training_path_enrolments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_path_enrolments_userId_idx" ON "training_path_enrolments"("userId");
CREATE INDEX "training_path_enrolments_pathId_idx" ON "training_path_enrolments"("pathId");
-- One open enrolment on a path per person
CREATE UNIQUE INDEX "training_path_enrolments_open_key" ON "training_path_enrolments"("pathId", "userId") WHERE "cancelledAt" IS NULL;
ALTER TABLE "training_path_enrolments" ADD CONSTRAINT "training_path_enrolments_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "training_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Classroom and poolside sessions with places and a register
CREATE TABLE "training_sessions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "courseId" TEXT,
    "siteId" TEXT,
    "location" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "capacity" INTEGER,
    "trainerName" TEXT NOT NULL DEFAULT '',
    "hoursTypeId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "registerClosedAt" TIMESTAMP(3),
    "registerClosedByName" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_sessions_minutes_check" CHECK ("minutes" BETWEEN 5 AND 1440),
    CONSTRAINT "training_sessions_capacity_check" CHECK ("capacity" IS NULL OR "capacity" BETWEEN 1 AND 500)
);
CREATE INDEX "training_sessions_orgId_startsAt_idx" ON "training_sessions"("orgId", "startsAt");
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "TrainingCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "training_session_places" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "markedAt" TIMESTAMP(3),

    CONSTRAINT "training_session_places_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_session_places_status_check" CHECK ("status" IN ('BOOKED', 'ATTENDED', 'ABSENT'))
);
CREATE UNIQUE INDEX "training_session_places_sessionId_userId_key" ON "training_session_places"("sessionId", "userId");
CREATE INDEX "training_session_places_userId_idx" ON "training_session_places"("userId");
ALTER TABLE "training_session_places" ADD CONSTRAINT "training_session_places_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- In-service hours, such as a lifeguard's 20 hours before renewing their qualification
CREATE TABLE "training_hours" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "typeId" TEXT,
    "on" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "sessionId" TEXT,
    "recordedById" TEXT,
    "recordedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedByName" TEXT,

    CONSTRAINT "training_hours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_hours_minutes_check" CHECK ("minutes" BETWEEN 5 AND 1440)
);
CREATE INDEX "training_hours_userId_on_idx" ON "training_hours"("userId", "on");
CREATE INDEX "training_hours_orgId_typeId_idx" ON "training_hours"("orgId", "typeId");
-- A session credits each person once
CREATE UNIQUE INDEX "training_hours_session_user_key" ON "training_hours"("sessionId", "userId") WHERE "sessionId" IS NOT NULL AND "removedAt" IS NULL;
ALTER TABLE "training_hours" ADD CONSTRAINT "training_hours_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "training_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- How many hours a qualification needs, over how many months
CREATE TABLE "training_hour_targets" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "hours" INTEGER NOT NULL,
    "windowMonths" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_hour_targets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "training_hour_targets_hours_check" CHECK ("hours" BETWEEN 1 AND 500),
    CONSTRAINT "training_hour_targets_windowMonths_check" CHECK ("windowMonths" BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX "training_hour_targets_typeId_key" ON "training_hour_targets"("typeId");
