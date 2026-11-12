-- Incidents: the hazards from the site's risk assessments that a report involved (owner,
-- 10 November 2026, D29). Additive: one new table.
CREATE TABLE IF NOT EXISTS "incidents_hazard_links" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "reportId" TEXT NOT NULL,
    "hazardId" TEXT NOT NULL,
    "hazardRef" TEXT NOT NULL,
    "hazard" TEXT NOT NULL,
    "assessment" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "reviewAsked" BOOLEAN NOT NULL DEFAULT false,
    "addedById" TEXT NOT NULL,
    "addedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,
    CONSTRAINT "incidents_hazard_links_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "incidents_hazard_links_reportId_idx" ON "incidents_hazard_links"("reportId");
CREATE INDEX IF NOT EXISTS "incidents_hazard_links_hazardId_idx" ON "incidents_hazard_links"("hazardId");

DO $$ BEGIN
  ALTER TABLE "incidents_hazard_links" ADD CONSTRAINT "incidents_hazard_links_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "incidents_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
