-- Rota (phase 8): shifts at a site. Additive only: one new table.

CREATE TABLE "RotaShift" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "requiredTypeId" TEXT,
    "userId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RotaShift_siteId_date_idx" ON "RotaShift"("siteId", "date");
CREATE INDEX "RotaShift_userId_date_idx" ON "RotaShift"("userId", "date");

ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_requiredTypeId_fkey" FOREIGN KEY ("requiredTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Same-day shifts of up to 16 hours.
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_times_check" CHECK ("startMinutes" >= 0 AND "endMinutes" <= 1440 AND "endMinutes" > "startMinutes" AND "endMinutes" - "startMinutes" <= 960);
