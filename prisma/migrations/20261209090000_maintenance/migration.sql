-- Maintenance (owner, 26 October 2026, D14): what is broken at each site, from the first report
-- until it is fixed. Additive: three new tables.
CREATE TABLE IF NOT EXISTS "maintenance_requests" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "siteId" TEXT NOT NULL,
    "area" TEXT NOT NULL DEFAULT '',
    "place" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "urgency" TEXT NOT NULL DEFAULT 'normal',
    "risk" TEXT NOT NULL DEFAULT 'none',
    "trackplan" TEXT NOT NULL DEFAULT 'unsure',
    "trackplanRef" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'reported',
    "outcome" TEXT NOT NULL DEFAULT '',
    "duplicateOfId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reportedById" TEXT NOT NULL,
    "reportedByName" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_requests_number_key" ON "maintenance_requests"("number");
CREATE INDEX IF NOT EXISTS "maintenance_requests_orgId_siteId_status_idx" ON "maintenance_requests"("orgId", "siteId", "status");
CREATE INDEX IF NOT EXISTS "maintenance_requests_siteId_area_status_idx" ON "maintenance_requests"("siteId", "area", "status");
CREATE INDEX IF NOT EXISTS "maintenance_requests_reportedById_idx" ON "maintenance_requests"("reportedById");

CREATE TABLE IF NOT EXISTS "maintenance_events" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_events_requestId_operationId_key" ON "maintenance_events"("requestId", "operationId");
CREATE INDEX IF NOT EXISTS "maintenance_events_requestId_createdAt_idx" ON "maintenance_events"("requestId", "createdAt");

CREATE TABLE IF NOT EXISTS "maintenance_photos" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "bytes" BYTEA NOT NULL,
    "addedById" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    CONSTRAINT "maintenance_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "maintenance_photos_requestId_idx" ON "maintenance_photos"("requestId");

DO $$ BEGIN
  ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "maintenance_photos" ADD CONSTRAINT "maintenance_photos_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
