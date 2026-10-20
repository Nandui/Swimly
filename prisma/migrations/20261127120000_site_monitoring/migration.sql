-- Site Monitoring (owner request, 20 October 2026): actions for managers, raised automatically when a
-- task is completed with a reading out of range. Additive: one new table.
CREATE TABLE IF NOT EXISTS "monitoring_actions" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "sourceHref" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reading" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "allowed" TEXT NOT NULL,
    "guidance" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT,
    "recordedByName" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "resolution" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "monitoring_actions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_actions_sourceKey_key" ON "monitoring_actions"("sourceKey");
CREATE INDEX IF NOT EXISTS "monitoring_actions_siteId_status_idx" ON "monitoring_actions"("siteId", "status");
CREATE INDEX IF NOT EXISTS "monitoring_actions_orgId_status_idx" ON "monitoring_actions"("orgId", "status");
