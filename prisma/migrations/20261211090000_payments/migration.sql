-- Payments (owner, 2 November 2026): failed direct debits from the monthly sheet until reception
-- recovers them. Additive: three new tables.
CREATE TABLE IF NOT EXISTS "payment_imports" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "added" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_imports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "payment_imports_orgId_month_idx" ON "payment_imports"("orgId", "month");

CREATE TABLE IF NOT EXISTS "payment_failures" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "copy" INTEGER NOT NULL DEFAULT 1,
    "memberNumber" TEXT NOT NULL DEFAULT '',
    "memberId" TEXT,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "returnCode" TEXT NOT NULL DEFAULT '',
    "returnReason" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'to_contact',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastContactAt" TIMESTAMP(3),
    "outcome" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_failures_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_failures_orgId_month_reference_amountCents_copy_key" ON "payment_failures"("orgId", "month", "reference", "amountCents", "copy");
CREATE INDEX IF NOT EXISTS "payment_failures_orgId_siteId_status_idx" ON "payment_failures"("orgId", "siteId", "status");
CREATE INDEX IF NOT EXISTS "payment_failures_memberId_status_idx" ON "payment_failures"("memberId", "status");
CREATE INDEX IF NOT EXISTS "payment_failures_orgId_memberNumber_idx" ON "payment_failures"("orgId", "memberNumber");

CREATE TABLE IF NOT EXISTS "payment_failure_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "failureId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_failure_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "payment_failure_events_failureId_operationId_key" ON "payment_failure_events"("failureId", "operationId");
CREATE INDEX IF NOT EXISTS "payment_failure_events_failureId_createdAt_idx" ON "payment_failure_events"("failureId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "payment_failure_events" ADD CONSTRAINT "payment_failure_events_failureId_fkey" FOREIGN KEY ("failureId") REFERENCES "payment_failures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
