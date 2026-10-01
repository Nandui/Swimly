-- Rota absences: extensions and "off again". Additive only: one column, one table.

ALTER TABLE "RotaAbsence" ADD COLUMN "continuesId" TEXT;
CREATE INDEX "RotaAbsence_continuesId_idx" ON "RotaAbsence"("continuesId");
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_continuesId_fkey" FOREIGN KEY ("continuesId") REFERENCES "RotaAbsence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RotaAbsenceUpdate" (
    "id" TEXT NOT NULL,
    "absenceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "lastDay" DATE,
    "note" TEXT NOT NULL DEFAULT '',
    "byId" TEXT,
    "byName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaAbsenceUpdate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RotaAbsenceUpdate_kind_check" CHECK ("kind" IN ('reported', 'extended', 'back'))
);

CREATE INDEX "RotaAbsenceUpdate_absenceId_createdAt_idx" ON "RotaAbsenceUpdate"("absenceId", "createdAt");
ALTER TABLE "RotaAbsenceUpdate" ADD CONSTRAINT "RotaAbsenceUpdate_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "RotaAbsence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Each absence already recorded starts its story as reported, with the days it has now.
INSERT INTO "RotaAbsenceUpdate" ("id", "absenceId", "kind", "lastDay", "note", "byId", "byName", "createdAt")
SELECT 'rau_' || "id", "id", 'reported', "lastDay", '', "reportedById", "reportedByName", "createdAt" FROM "RotaAbsence";
