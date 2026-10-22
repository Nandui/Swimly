-- Wellbeing check requests to HR on incident reports, and who gets them (owner request, 22 October 2026). Additive: three new tables.
CREATE TABLE IF NOT EXISTS "incidents_settings" (
    "orgId" TEXT NOT NULL,
    "wellbeingTo" TEXT NOT NULL DEFAULT '',
    "changedById" TEXT,
    "changedByName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "incidents_settings_pkey" PRIMARY KEY ("orgId")
);

CREATE TABLE IF NOT EXISTS "incidents_wellbeing_checks" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "personUserId" TEXT,
    "reason" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "emailedAt" TIMESTAMP(3),
    "emailError" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByName" TEXT,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidents_wellbeing_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "incidents_wellbeing_updates" (
    "id" TEXT NOT NULL,
    "checkId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "doneOn" TEXT NOT NULL,
    "whatDone" TEXT NOT NULL,
    "nextSteps" TEXT NOT NULL DEFAULT '',
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "incidents_wellbeing_updates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "incidents_wellbeing_checks_tokenHash_key" ON "incidents_wellbeing_checks"("tokenHash");
CREATE INDEX IF NOT EXISTS "incidents_wellbeing_checks_reportId_idx" ON "incidents_wellbeing_checks"("reportId");
CREATE INDEX IF NOT EXISTS "incidents_wellbeing_updates_checkId_idx" ON "incidents_wellbeing_updates"("checkId");

ALTER TABLE "incidents_wellbeing_checks" ADD CONSTRAINT "incidents_wellbeing_checks_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents_wellbeing_updates" ADD CONSTRAINT "incidents_wellbeing_updates_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "incidents_wellbeing_checks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
