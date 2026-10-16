-- Each area's own needs on the rota, with hours by weekday (owner request, 16 October 2026). Additive.
ALTER TABLE "SiteArea" ADD COLUMN IF NOT EXISTS "weekHours" JSONB;

CREATE TABLE IF NOT EXISTS "RotaAreaAssignment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "qualificationTypeId" TEXT,
    "place" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaAreaAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RotaAreaAssignment_siteId_date_idx" ON "RotaAreaAssignment"("siteId", "date");
CREATE INDEX IF NOT EXISTS "RotaAreaAssignment_userId_date_idx" ON "RotaAreaAssignment"("userId", "date");
CREATE INDEX IF NOT EXISTS "RotaAreaAssignment_areaId_date_idx" ON "RotaAreaAssignment"("areaId", "date");

ALTER TABLE "RotaAreaAssignment" ADD CONSTRAINT "RotaAreaAssignment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotaAreaAssignment" ADD CONSTRAINT "RotaAreaAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
