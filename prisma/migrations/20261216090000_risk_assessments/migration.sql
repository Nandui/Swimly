-- Risk assessments (owner, 10 November 2026, D29): the hazards of each area, job and activity at
-- a site, what controls them, who signed that off and when it is next reviewed.
-- Additive: five new tables.
CREATE TABLE IF NOT EXISTS "risk_assessments" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL DEFAULT 'area',
    "subject" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT '',
    "departmentId" TEXT,
    "ownerId" TEXT,
    "ownerName" TEXT NOT NULL DEFAULT '',
    "assessorName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "archivedFrom" TEXT NOT NULL DEFAULT '',
    "assessedOn" TEXT NOT NULL,
    "reviewMonths" INTEGER NOT NULL DEFAULT 12,
    "targetScore" INTEGER NOT NULL DEFAULT 8,
    "lastReviewedOn" TEXT,
    "nextReviewOn" TEXT NOT NULL,
    "ownerApprovedById" TEXT,
    "ownerApprovedByName" TEXT,
    "ownerApprovedAt" TIMESTAMP(3),
    "execApprovedById" TEXT,
    "execApprovedByName" TEXT,
    "execApprovedAt" TIMESTAMP(3),
    "hazardSeq" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_assessments_orgId_reference_key" ON "risk_assessments"("orgId", "reference");
CREATE INDEX IF NOT EXISTS "risk_assessments_orgId_siteId_status_idx" ON "risk_assessments"("orgId", "siteId", "status");
CREATE INDEX IF NOT EXISTS "risk_assessments_siteId_subjectType_subject_idx" ON "risk_assessments"("siteId", "subjectType", "subject");
CREATE INDEX IF NOT EXISTS "risk_assessments_status_nextReviewOn_idx" ON "risk_assessments"("status", "nextReviewOn");
CREATE INDEX IF NOT EXISTS "risk_assessments_ownerId_status_idx" ON "risk_assessments"("ownerId", "status");

CREATE TABLE IF NOT EXISTS "risk_hazards" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hazard" TEXT NOT NULL,
    "riskFactor" TEXT NOT NULL DEFAULT '',
    "personsAtRisk" TEXT NOT NULL DEFAULT '',
    "consequence" TEXT NOT NULL DEFAULT '',
    "inherentLikelihood" INTEGER NOT NULL DEFAULT 1,
    "inherentSeverity" INTEGER NOT NULL DEFAULT 1,
    "controls" TEXT NOT NULL DEFAULT '',
    "likelihood" INTEGER NOT NULL DEFAULT 1,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "score" INTEGER NOT NULL DEFAULT 1,
    "furtherAction" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'physical',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "risk_hazards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_hazards_assessmentId_seq_key" ON "risk_hazards"("assessmentId", "seq");
CREATE INDEX IF NOT EXISTS "risk_hazards_orgId_score_idx" ON "risk_hazards"("orgId", "score");

CREATE TABLE IF NOT EXISTS "risk_reviews" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "reviewedOn" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerName" TEXT NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'no_changes',
    "notes" TEXT NOT NULL DEFAULT '',
    "nextReviewOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "risk_reviews_assessmentId_reviewedOn_idx" ON "risk_reviews"("assessmentId", "reviewedOn");

CREATE TABLE IF NOT EXISTS "risk_review_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "hazardId" TEXT,
    "requestedById" TEXT,
    "requestedByName" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolvedByName" TEXT,
    "resolutionNote" TEXT NOT NULL DEFAULT '',
    "sourceIncidentId" TEXT,
    "sourceIncidentRef" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_review_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "risk_review_requests_orgId_siteId_status_idx" ON "risk_review_requests"("orgId", "siteId", "status");
CREATE INDEX IF NOT EXISTS "risk_review_requests_assessmentId_status_idx" ON "risk_review_requests"("assessmentId", "status");
CREATE INDEX IF NOT EXISTS "risk_review_requests_sourceIncidentId_idx" ON "risk_review_requests"("sourceIncidentId");

CREATE TABLE IF NOT EXISTS "risk_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "risk_events_assessmentId_operationId_key" ON "risk_events"("assessmentId", "operationId");
CREATE INDEX IF NOT EXISTS "risk_events_assessmentId_createdAt_idx" ON "risk_events"("assessmentId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "risk_hazards" ADD CONSTRAINT "risk_hazards_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "risk_reviews" ADD CONSTRAINT "risk_reviews_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "risk_review_requests" ADD CONSTRAINT "risk_review_requests_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "risk_assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
