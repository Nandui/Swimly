-- Minimum staff for each area, and the hours it is open (owner request, 16 October 2026). Additive.
ALTER TABLE "SiteArea" ADD COLUMN IF NOT EXISTS "openFrom" INTEGER;
ALTER TABLE "SiteArea" ADD COLUMN IF NOT EXISTS "openUntil" INTEGER;

CREATE TABLE IF NOT EXISTS "SiteAreaStaffing" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "qualificationTypeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SiteAreaStaffing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteAreaStaffing_areaId_idx" ON "SiteAreaStaffing"("areaId");

ALTER TABLE "SiteAreaStaffing" ADD CONSTRAINT "SiteAreaStaffing_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "SiteArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SiteAreaStaffing" ADD CONSTRAINT "SiteAreaStaffing_qualificationTypeId_fkey" FOREIGN KEY ("qualificationTypeId") REFERENCES "QualificationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
