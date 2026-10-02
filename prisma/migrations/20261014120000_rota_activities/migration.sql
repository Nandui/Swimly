-- Rota: activities a site needs covered during a day (25m pool lifeguard 06:30-21:30), planned on their own. Additive only: one table.

CREATE TABLE "RotaActivity" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "people" INTEGER NOT NULL DEFAULT 1,
    "requiredTypeId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaActivity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaActivity_times_check" CHECK ("endMinutes" > "startMinutes"),
    CONSTRAINT "RotaActivity_people_check" CHECK ("people" BETWEEN 1 AND 20)
);

CREATE INDEX "RotaActivity_siteId_date_idx" ON "RotaActivity"("siteId", "date");
ALTER TABLE "RotaActivity" ADD CONSTRAINT "RotaActivity_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RotaActivity" ADD CONSTRAINT "RotaActivity_requiredTypeId_fkey" FOREIGN KEY ("requiredTypeId") REFERENCES "QualificationType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
