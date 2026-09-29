-- Rota roster import (docs/rota.md): everyone on the payroll roster by employee number, department
-- codes mapped to sites, each week's uploads and what they changed. Additive: new tables and
-- nullable columns; an absence's account becomes optional so people without a login can be off.

-- AlterTable
ALTER TABLE "RotaAbsence" ADD COLUMN     "rotaPersonId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RotaShift" ADD COLUMN     "departmentCode" TEXT,
ADD COLUMN     "importId" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'shift',
ADD COLUMN     "rotaPersonId" TEXT;

-- CreateTable
CREATE TABLE "RotaPerson" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaDepartment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaImport" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "fileName" TEXT NOT NULL,
    "importedById" TEXT,
    "importedByName" TEXT NOT NULL,
    "shifts" INTEGER NOT NULL DEFAULT 0,
    "holidays" INTEGER NOT NULL DEFAULT 0,
    "people" INTEGER NOT NULL DEFAULT 0,
    "added" INTEGER NOT NULL DEFAULT 0,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "changed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaChange" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "importId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "employeeNo" TEXT NOT NULL,
    "personName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "before" TEXT NOT NULL DEFAULT '',
    "after" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotaChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RotaPerson_userId_key" ON "RotaPerson"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RotaPerson_orgId_employeeNo_key" ON "RotaPerson"("orgId", "employeeNo");

-- CreateIndex
CREATE UNIQUE INDEX "RotaDepartment_orgId_code_key" ON "RotaDepartment"("orgId", "code");

-- CreateIndex
CREATE INDEX "RotaImport_orgId_weekStart_idx" ON "RotaImport"("orgId", "weekStart");

-- CreateIndex
CREATE INDEX "RotaChange_importId_idx" ON "RotaChange"("importId");

-- CreateIndex
CREATE INDEX "RotaChange_orgId_date_idx" ON "RotaChange"("orgId", "date");

-- CreateIndex
CREATE INDEX "RotaAbsence_rotaPersonId_firstDay_idx" ON "RotaAbsence"("rotaPersonId", "firstDay");

-- CreateIndex
CREATE INDEX "RotaShift_rotaPersonId_date_idx" ON "RotaShift"("rotaPersonId", "date");

-- CreateIndex
CREATE INDEX "RotaShift_importId_idx" ON "RotaShift"("importId");

-- AddForeignKey
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_rotaPersonId_fkey" FOREIGN KEY ("rotaPersonId") REFERENCES "RotaPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_importId_fkey" FOREIGN KEY ("importId") REFERENCES "RotaImport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaPerson" ADD CONSTRAINT "RotaPerson_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaPerson" ADD CONSTRAINT "RotaPerson_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaDepartment" ADD CONSTRAINT "RotaDepartment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaDepartment" ADD CONSTRAINT "RotaDepartment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Club"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaImport" ADD CONSTRAINT "RotaImport_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaChange" ADD CONSTRAINT "RotaChange_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaChange" ADD CONSTRAINT "RotaChange_importId_fkey" FOREIGN KEY ("importId") REFERENCES "RotaImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_rotaPersonId_fkey" FOREIGN KEY ("rotaPersonId") REFERENCES "RotaPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- An absence names someone: their account, their roster entry, or both.
ALTER TABLE "RotaAbsence" ADD CONSTRAINT "RotaAbsence_person_check" CHECK ("userId" IS NOT NULL OR "rotaPersonId" IS NOT NULL);

-- A roster holiday or leave day has no times; an imported shift may run past midnight (the
-- roster's 18:30 - 01:00 ends at 25:00). Still at most 16 hours. Shifts added by hand keep
-- their same-day rule in the app.
ALTER TABLE "RotaShift" DROP CONSTRAINT "RotaShift_times_check";
ALTER TABLE "RotaShift" ADD CONSTRAINT "RotaShift_times_check" CHECK (
  "startMinutes" >= 0 AND (
    ("kind" <> 'shift' AND "startMinutes" = 0 AND "endMinutes" = 0)
    OR ("endMinutes" > "startMinutes" AND "endMinutes" <= 2880 AND "endMinutes" - "startMinutes" <= 960)
  )
);
