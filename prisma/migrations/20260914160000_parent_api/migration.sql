BEGIN;

-- Keep the initial snapshot and trigger installation atomic with teaching writes.
LOCK TABLE "CompetencyResult", "LevelCompletion", "AssessmentBooking" IN SHARE ROW EXCLUSIVE MODE;

-- CreateTable
CREATE TABLE "ParentAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentSession" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentSignInChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentSignInChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentRateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "ParentRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ParentChildAccess" (
    "id" TEXT NOT NULL,
    "parentEmail" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "grantedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentChildAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAssessmentPublication" (
    "sessionId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "bookingClosesAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAssessmentPublication_pkey" PRIMARY KEY ("sessionId")
);

-- CreateTable
CREATE TABLE "ParentBookingRequest" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentBookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProgressEvent" (
    "id" BIGSERIAL NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "value" JSONB,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releaseAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentProgressEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccount_email_key" ON "ParentAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ParentSession_tokenHash_key" ON "ParentSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentSession_parentId_expiresAt_idx" ON "ParentSession"("parentId", "expiresAt");

-- CreateIndex
CREATE INDEX "ParentSignInChallenge_email_createdAt_idx" ON "ParentSignInChallenge"("email", "createdAt");

-- CreateIndex
CREATE INDEX "ParentChildAccess_studentId_idx" ON "ParentChildAccess"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentChildAccess_parentEmail_studentId_key" ON "ParentChildAccess"("parentEmail", "studentId");

-- CreateIndex
CREATE INDEX "ParentBookingRequest_bookingId_idx" ON "ParentBookingRequest"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentBookingRequest_parentId_key_key" ON "ParentBookingRequest"("parentId", "key");

-- CreateIndex
CREATE INDEX "ParentProgressEvent_studentId_kind_subjectId_releaseAt_id_idx" ON "ParentProgressEvent"("studentId", "kind", "subjectId", "releaseAt", "id");

-- AddForeignKey
ALTER TABLE "ParentSession" ADD CONSTRAINT "ParentSession_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentChildAccess" ADD CONSTRAINT "ParentChildAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAssessmentPublication" ADD CONSTRAINT "ParentAssessmentPublication_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AssessmentSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentBookingRequest" ADD CONSTRAINT "ParentBookingRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ParentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentBookingRequest" ADD CONSTRAINT "ParentBookingRequest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AssessmentBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProgressEvent" ADD CONSTRAINT "ParentProgressEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Prisma timestamps are UTC without a zone. Release at the following Dublin
-- midnight, including the 23/25-hour days when Irish clocks change.
CREATE FUNCTION parent_progress_release_at(saved_at timestamp) RETURNS timestamp
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (((saved_at AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Dublin')::date + 1)::timestamp
    AT TIME ZONE 'Europe/Dublin') AT TIME ZONE 'UTC';
$$;

CREATE FUNCTION parent_progress_value(kind text, row_data jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE kind
    WHEN 'competency' THEN jsonb_build_object('status', row_data->'status', 'assessedOn', row_data->'assessedOn')
    WHEN 'completion' THEN jsonb_build_object('programmeId', row_data->'programmeId', 'completedOn', row_data->'completedOn',
      'achieved', row_data->'competenciesAchieved', 'total', row_data->'competencyCount')
    WHEN 'assessment' THEN CASE WHEN row_data->>'outcomeLevelId' IS NOT NULL
      THEN jsonb_build_object('levelId', row_data->'outcomeLevelId', 'assessedOn', row_data->'assessedOn') END
  END;
$$;

-- Only the state present at installation can be backfilled reliably. Later
-- changes preserve every prior released state, including removals/corrections.
INSERT INTO "ParentProgressEvent" ("studentId",kind,"subjectId",value,"recordedAt","releaseAt")
SELECT "studentId", 'competency', "competencyId", parent_progress_value('competency',to_jsonb(r)), "updatedAt", parent_progress_release_at("updatedAt") FROM "CompetencyResult" r;
INSERT INTO "ParentProgressEvent" ("studentId",kind,"subjectId",value,"recordedAt","releaseAt")
SELECT "studentId", 'completion', "levelId", parent_progress_value('completion',to_jsonb(r)), "updatedAt", parent_progress_release_at("updatedAt") FROM "LevelCompletion" r;
INSERT INTO "ParentProgressEvent" ("studentId",kind,"subjectId",value,"recordedAt","releaseAt")
SELECT "studentId", 'assessment', id, parent_progress_value('assessment',to_jsonb(r)), "updatedAt", parent_progress_release_at("updatedAt") FROM "AssessmentBooking" r WHERE "outcomeLevelId" IS NOT NULL;

CREATE FUNCTION parent_capture_progress() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  previous_row jsonb; next_row jsonb; previous_value jsonb; next_value jsonb;
  saved_at timestamp := clock_timestamp() AT TIME ZONE 'UTC';
BEGIN
  IF TG_OP <> 'INSERT' THEN
    previous_row := to_jsonb(OLD);
    previous_value := parent_progress_value(TG_ARGV[0],previous_row);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    next_row := to_jsonb(NEW);
    next_value := parent_progress_value(TG_ARGV[0],next_row);
  END IF;
  IF TG_OP = 'UPDATE' AND previous_value IS NOT DISTINCT FROM next_value
    AND previous_row->>'studentId' = next_row->>'studentId'
    AND previous_row->>TG_ARGV[1] = next_row->>TG_ARGV[1] THEN RETURN NULL; END IF;

  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND
    (previous_row->>'studentId' <> next_row->>'studentId' OR previous_row->>TG_ARGV[1] <> next_row->>TG_ARGV[1])) THEN
    IF previous_value IS NOT NULL THEN
      INSERT INTO "ParentProgressEvent" ("studentId",kind,"subjectId",value,"recordedAt","releaseAt")
      VALUES (previous_row->>'studentId',TG_ARGV[0],previous_row->>TG_ARGV[1],NULL,saved_at,parent_progress_release_at(saved_at));
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' AND (next_value IS NOT NULL OR previous_value IS NOT NULL) THEN
    INSERT INTO "ParentProgressEvent" ("studentId",kind,"subjectId",value,"recordedAt","releaseAt")
    VALUES (next_row->>'studentId',TG_ARGV[0],next_row->>TG_ARGV[1],next_value,saved_at,parent_progress_release_at(saved_at));
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER parent_competency_history AFTER INSERT OR UPDATE OR DELETE ON "CompetencyResult"
FOR EACH ROW EXECUTE FUNCTION parent_capture_progress('competency','competencyId');
CREATE TRIGGER parent_completion_history AFTER INSERT OR UPDATE OR DELETE ON "LevelCompletion"
FOR EACH ROW EXECUTE FUNCTION parent_capture_progress('completion','levelId');
CREATE TRIGGER parent_assessment_history AFTER INSERT OR UPDATE OR DELETE ON "AssessmentBooking"
FOR EACH ROW EXECUTE FUNCTION parent_capture_progress('assessment','id');

COMMIT;
